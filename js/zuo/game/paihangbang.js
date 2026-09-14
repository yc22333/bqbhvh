// ============================================================
// paihangbang.js — 牢区小游戏 · 实时排行榜 (Supabase 数据库版)
// 功能: 管理三个游戏的成绩记录、排行展示、多人实时同步
// 依赖: mode.js (Mode 命名空间), Supabase (CDN)
// [CREATED: 2026-06-11]
// ============================================================

const PaiHangBang = (() => {
  'use strict';

  const CONFIG = { debugTag: 'PaiHangBang' };
  const POLL_INTERVAL = 15000;
  const MAX_RECORDS = 10;

  /* ── Supabase 配置（不推荐前端直连数据库） ── */
  // ⚠️ 安全警告：不要将 API Key 直接硬编码在前端代码中！
  // 如果需要使用 Supabase，请通过后端代理（Netlify Function）转发请求，
  // 或者至少确保在 Supabase Dashboard 中启用 RLS 并设置严格的 Policies。
  // 如需使用 Supabase，请通过 window.BQB_CONFIG 注入配置，例如：
  //   <script>window.BQB_CONFIG = { SUPABASE_URL: '...', SUPABASE_KEY: '...' };</script>
  const BQB_CONFIG = (typeof window !== 'undefined' && window.BQB_CONFIG) || {};
  const SUPABASE_URL = BQB_CONFIG.SUPABASE_URL || '';
  const SUPABASE_KEY = BQB_CONFIG.SUPABASE_KEY || '';
  const TABLE_NAME = 'leaderboard';
  const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

  /* ── Netlify Function 端点（推荐使用：由服务端代理，更安全） ── */
  // Netlify 部署后实际路径为 /.netlify/functions/leaderboard
  const NETLIFY_ENDPOINT = '/.netlify/functions/leaderboard';

  /* ── localStorage 本地存储的键名 ── */
  const LOCAL_KEY = 'bqb_leaderboard_records';

  /* ── 游戏配置 ── */
  const GAMES = {
    game1: { name: '🎯 气泡点击', sortAsc: false },
    game2: { name: '⚡ 反应训练', sortAsc: true },
    game3: { name: '⛏️ 挂机挖宝', sortAsc: false },
  };

  /* ── 当前使用的存储模式: 'supabase' | 'supabase-rest' | 'netlify' | 'local' ── */
  // 优先使用 Netlify Function（服务端代理，有安全校验）
  // 如果配置了 Supabase 则优先使用，否则默认尝试 Netlify Function
  let storageMode = USE_SUPABASE ? 'supabase' : 'netlify';
  let supabase = null;
  let cachedRecords = [];
  let initialized = false;
  let pollTimer = null;
  const NAME_KEY = 'bqb_leaderboard_name';
  let netlifyTestAttempts = 0;
  const MAX_NETLIFY_ATTEMPTS = 3;

  /* ── 初始化 Supabase 客户端 ── */
  function initSupabase() {
    // Supabase v2 CDN 导出的全局对象名是 'supabase'，不是 'supabaseClient'
    const sb = (typeof supabase !== 'undefined' && supabase)
      ? supabase
      : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

    if (sb && typeof sb.createClient === 'function') {
      try {
        supabase = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
        Mode.Debug.log(CONFIG.debugTag, '✅ Supabase 客户端已创建');
        return true;
      } catch (e) {
        Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase 初始化异常:', e.message);
        supabase = null;
      }
    } else {
      Mode.Debug.warn(CONFIG.debugTag, '⏳ 全局 supabase 对象尚不可用（CDN 可能还在加载）');
    }
    return false;
  }

  /* ── 轮询检测 Supabase CDN 是否已加载完成（最多等待 timeoutMs 毫秒） ── */
  function waitForSupabase(timeoutMs) {
    return new Promise(function(resolve) {
      var start = Date.now();
      var attempts = 0;
      function check() {
        attempts++;
        const sb = (typeof supabase !== 'undefined' && supabase)
          ? supabase
          : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (sb && typeof sb.createClient === 'function') {
          Mode.Debug.log(CONFIG.debugTag, '✅ Supabase CDN 已就绪 (尝试 ' + attempts + ' 次)');
          resolve(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          Mode.Debug.warn(CONFIG.debugTag, '⏱️ Supabase CDN 超时未加载 (' + timeoutMs + 'ms)');
          resolve(false);
          return;
        }
        setTimeout(check, 300);
      }
      check();
    });
  }

  /* ── 测试 Supabase 真实读写（createClient 成功不代表能查询） ── */
  async function testSupabaseConnection() {
    if (!supabase) return false;
    try {
      Mode.Debug.log(CONFIG.debugTag, '🔍 正在测试 Supabase 查询...');
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id, player_name, game_id, score')
        .limit(1);
      if (error) {
        Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase 查询失败:', error.message);
        Mode.Debug.warn(CONFIG.debugTag, '   → 可能原因: 表不存在 / RLS 策略未开启 / anon 无 SELECT 权限');
        Mode.Debug.warn(CONFIG.debugTag, '   → 请登录 Supabase Dashboard → Table Editor 检查 `' + TABLE_NAME + '` 表');
        Mode.Debug.warn(CONFIG.debugTag, '   → Auth → Policies 为 ' + TABLE_NAME + ' 添加 SELECT/INSERT 策略 (USING true)');
        return false;
      }
      Mode.Debug.log(CONFIG.debugTag, '✅ Supabase 连接测试通过，查询到 ' + (data ? data.length : 0) + ' 条记录');
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase 网络异常:', e.message);
      return false;
    }
  }

  /* ── 用纯 REST/fetch 直接测试 Supabase（不依赖 supabase-js CDN） ── */
  async function testSupabaseRest() {
    try {
      const url = SUPABASE_URL + '/rest/v1/' + TABLE_NAME + '?select=*&limit=1';
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase REST 测试失败 (HTTP ' + res.status + '): ' + errText.slice(0, 200));
        if (res.status === 404 || errText.indexOf('does not exist') >= 0) {
          Mode.Debug.warn(CONFIG.debugTag, '   → 表 `' + TABLE_NAME + '` 不存在！请在 Supabase SQL Editor 运行建表 SQL');
        } else if (res.status === 401 || res.status === 403) {
          Mode.Debug.warn(CONFIG.debugTag, '   → RLS 权限问题。请执行: alter table ' + TABLE_NAME + ' disable row level security;');
        }
        return { ok: false, message: 'HTTP ' + res.status };
      }
      const data = await res.json();
      Mode.Debug.log(CONFIG.debugTag, '✅ Supabase REST 测试通过，查询到 ' + (data ? data.length : 0) + ' 条记录');
      return { ok: true, records: data };
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase REST 网络异常:', e.message);
      return { ok: false, message: e.message };
    }
  }

  /* ── 用纯 REST/fetch 读取所有记录 ── */
  async function fetchFromSupabaseRest() {
    const url = SUPABASE_URL + '/rest/v1/' + TABLE_NAME + '?select=*&order=created_at.desc&limit=' + (MAX_RECORDS * 5);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data || [];
  }

  /* ── 用纯 REST/fetch 写入记录 ── */
  async function pushRecordToSupabaseRest(record) {
    const payload = {
      player_name: record.player_name,
      game_id: record.game_id,
      score: record.score,
      details: record.details || {},
    };
    const url = SUPABASE_URL + '/rest/v1/' + TABLE_NAME;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('HTTP ' + res.status + ': ' + errText.slice(0, 200));
    }
    Mode.Debug.log(CONFIG.debugTag, '✅ Supabase REST 写入成功');
    return true;
  }

  /* ── 测试 Netlify Function 是否可用（失败时读取诊断信息，支持重试） ── */
  async function testNetlifyEndpoint(attempt = 1) {
    netlifyTestAttempts = attempt;
    Mode.Debug.log(CONFIG.debugTag, '🔍 开始测试 Netlify Function (尝试 ' + attempt + ')');
    
    try {
      const startTime = Date.now();
      Mode.Debug.log(CONFIG.debugTag, '📡 发送请求到: ' + NETLIFY_ENDPOINT);
      
      const res = await fetch(NETLIFY_ENDPOINT, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });
      
      const responseTime = Date.now() - startTime;
      Mode.Debug.log(CONFIG.debugTag, '⏱️ 响应时间: ' + responseTime + 'ms, HTTP状态: ' + res.status);
      
      if (!res.ok) {
        // 读取响应体中的错误信息，帮助诊断
        try {
          const errData = await res.json();
          Mode.Debug.warn(CONFIG.debugTag, '⚠️  Netlify Function 返回错误 (HTTP ' + res.status + '):');
          Mode.Debug.warn(CONFIG.debugTag, '   错误信息: ' + (errData.error || errData.msg || '未知错误'));
          if (errData.debug) {
            Mode.Debug.warn(CONFIG.debugTag, '   诊断详情: ' + JSON.stringify(errData.debug));
          }
        } catch (e) {
          Mode.Debug.warn(CONFIG.debugTag, '⚠️  Netlify Function HTTP ' + res.status + '（无法解析响应体）');
        }
        
        // 如果是 5xx 错误，尝试重试
        if (res.status >= 500 && attempt < MAX_NETLIFY_ATTEMPTS) {
          Mode.Debug.log(CONFIG.debugTag, '🔄 尝试重试 Netlify Function (' + attempt + '/' + MAX_NETLIFY_ATTEMPTS + ')');
          await new Promise(r => setTimeout(r, 1000 * attempt));
          return testNetlifyEndpoint(attempt + 1);
        }
        Mode.Debug.log(CONFIG.debugTag, '❌ Netlify Function 测试失败，返回 false');
        return false;
      }
      
      // 成功！
      Mode.Debug.log(CONFIG.debugTag, '✅ Netlify Function 测试成功');
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '❌ 无法连接到 Netlify Function (尝试 ' + attempt + '/' + MAX_NETLIFY_ATTEMPTS + '):', e.message);
      
      // 网络错误时尝试重试
      if (attempt < MAX_NETLIFY_ATTEMPTS) {
        Mode.Debug.log(CONFIG.debugTag, '🔄 网络错误，重试中...');
        await new Promise(r => setTimeout(r, 1000 * attempt));
        return testNetlifyEndpoint(attempt + 1);
      }
      
      Mode.Debug.warn(CONFIG.debugTag, '   → 如果是本地预览，这属于正常现象');
      Mode.Debug.warn(CONFIG.debugTag, '   → 如果是已部署网站，请检查 Functions 是否正常部署');
      Mode.Debug.log(CONFIG.debugTag, '❌ Netlify Function 测试失败（所有重试已用完），返回 false');
      return false;
    }
  }

  /* ── 从 localStorage 读取 ── */
  function fetchFromLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, 'localStorage 读取失败:', e.message);
      return [];
    }
  }

  /* ── 写入 localStorage ── */
  function pushToLocal(records) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, 'localStorage 写入失败:', e.message);
      return false;
    }
  }

  /* ── 从 Netlify Function 读取 ── */
  async function fetchFromNetlify() {
    try {
      const res = await fetch(NETLIFY_ENDPOINT, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // leaderboard.js 返回 { playerName, records: [...] } 或旧格式
      const records = data.records || data || [];
      return Array.isArray(records) ? records : [];
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, 'Netlify 读取失败:', e.message);
      return [];
    }
  }

  /* ── 写入 Netlify Function（单条提交，匹配 leaderboard.js 的 POST 接口） ── */
  async function pushRecordToNetlify(record) {
    try {
      const res = await fetch(NETLIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: record.player_name || '玩家',
          gameId: record.game_id || 'game1',
          score: record.score,
          details: record.details || {},
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      Mode.Debug.log(CONFIG.debugTag, '✅ Netlify 单条提交成功:', record.player_name, record.score);
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, 'Netlify 单条提交失败:', e.message);
      throw e;
    }
  }

  /* ── 写入 Netlify Function（全量覆盖，仅用于兼容旧逻辑） ── */
  async function pushToNetlify(records, playerName) {
    try {
      // 优先使用单条提交模式：将最后一条记录发送给后端
      const lastRecord = records && records.length > 0 ? records[records.length - 1] : null;
      if (lastRecord) {
        return await pushRecordToNetlify(lastRecord);
      }
      // 回退：尝试全量格式（不推荐，后端可能不认）
      const res = await fetch(NETLIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName || '玩家',
          records: records,
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, 'Netlify 写入失败:', e.message);
      return false;
    }
  }

  /* ── 统一降级入口：先试 Netlify，再试 localStorage ── */
  async function fallbackToNetlifyOrLocal() {
    if (await testNetlifyEndpoint()) {
      storageMode = 'netlify';
      Mode.Debug.log(CONFIG.debugTag, '🔄 降级到 Netlify Blobs');
      showToast('⚠️ Supabase不可用，切换到Netlify');
      return await fetchFromNetlify();
    }
    storageMode = 'local';
    Mode.Debug.log(CONFIG.debugTag, '🔄 降级到 localStorage');
    showToast('⚠️ 排行榜仅本地可见');
    return fetchFromLocal();
  }

  /* ── 从数据库读取所有记录 ── */
  async function fetchFromServer() {
    // 模式 A: 使用 supabase-js 客户端
    if (storageMode === 'supabase' && supabase) {
      try {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          Mode.Debug.warn(CONFIG.debugTag, '❌ Supabase-js 查询错误:', error.message);
          throw new Error(error.message || 'Supabase query error');
        }
        return data || [];
      } catch (e) {
        Mode.Debug.warn(CONFIG.debugTag, 'Supabase-js 读取失败，尝试 REST 模式...');
        try {
          const records = await fetchFromSupabaseRest();
          storageMode = 'supabase-rest';
          return records;
        } catch (e2) {
          return await fallbackToNetlifyOrLocal();
        }
      }
    }
    // 模式 B: 使用纯 REST/fetch (不依赖 CDN)
    if (storageMode === 'supabase-rest') {
      try {
        return await fetchFromSupabaseRest();
      } catch (e) {
        return await fallbackToNetlifyOrLocal();
      }
    }
    // 模式 C: Netlify Blobs
    if (storageMode === 'netlify') {
      try {
        return await fetchFromNetlify();
      } catch (e) {
        storageMode = 'local';
        Mode.Debug.warn(CONFIG.debugTag, 'Netlify 读取失败，降级到本地');
        showToast('⚠️ 服务器异常，排行榜仅本地可见');
        return fetchFromLocal();
      }
    }
    return fetchFromLocal();
  }

  /* ── 写入降级入口 ── */
  async function pushRecordFallback(record) {
    if (await testNetlifyEndpoint()) {
      storageMode = 'netlify';
      const current = await fetchFromNetlify();
      current.push(record);
      return await pushToNetlify(current, record.player_name);
    }
    storageMode = 'local';
    Mode.Debug.warn(CONFIG.debugTag, '🔄 写入降级到 localStorage');
    const current = fetchFromLocal();
    current.push(record);
    return pushToLocal(current);
  }

  /* ── 插入新记录（强制云端模式）── */
  async function pushRecord(record) {
    // 强制使用 Netlify Function（不降级到本地）
    if (storageMode === 'netlify') {
      Mode.Debug.log(CONFIG.debugTag, '📤 提交成绩到云端...');
      try {
        const result = await pushRecordToNetlify(record);
        Mode.Debug.log(CONFIG.debugTag, '✅ 云端提交成功');
        return result;
      } catch (e) {
        Mode.Debug.error(CONFIG.debugTag, '❌ 云端提交失败:', e.message);
        throw e; // 抛出错误，不降级到本地
      }
    }
    // 如果模式不是 netlify（不应该发生），报错
    Mode.Debug.error(CONFIG.debugTag, '❌ 无效的存储模式: ' + storageMode);
    throw new Error('无效的存储模式');
  }

  /* ── 清空所有记录 ── */
  async function deleteAllFromServer() {
    if (storageMode === 'supabase' && supabase) {
      try {
        await supabase.from(TABLE_NAME).delete().neq('id', 0);
      } catch (e) {
        Mode.Debug.warn(CONFIG.debugTag, '清空失败:', e.message);
      }
    } else if (storageMode === 'supabase-rest') {
      try {
        const url = SUPABASE_URL + '/rest/v1/' + TABLE_NAME + '?id=not.eq.0';
        await fetch(url, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
        });
      } catch (e) {
        Mode.Debug.warn(CONFIG.debugTag, '清空失败:', e.message);
      }
    } else if (storageMode === 'netlify') {
      await pushToNetlify([], '玩家');
    } else {
      pushToLocal([]);
    }
  }

  /* ── 加载数据 ── */
  async function loadData() {
    cachedRecords = await fetchFromServer();
    refreshAll();
    Mode.Debug.log(CONFIG.debugTag, '数据已加载 [mode=' + storageMode + '], 共 ' + cachedRecords.length + ' 条');
  }

  /* ── 轮询 ── */
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      const records = await fetchFromServer();
      cachedRecords = records;
      refreshAll();
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ── 玩家名称 ── */
  function getPlayerName() {
    try {
      var n = localStorage.getItem(NAME_KEY);
      if (n && n.trim().length > 0) return n.trim().slice(0, 12);
    } catch (e) {}
    return '玩家';
  }
  function setPlayerName(name) {
    try {
      var n = (name || '').toString().trim().slice(0, 12);
      if (n.length > 0) {
        localStorage.setItem(NAME_KEY, n);
        Mode.Debug.log(CONFIG.debugTag, '玩家名已更新: ' + n);
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '保存玩家名失败:', e.message);
    }
  }

  /* ── 提交成绩 ── */
  async function submitScore(gameId, score, details) {
    var game = GAMES[gameId];
    if (!game) return false;

    var newRecord = {
      player_name: getPlayerName(),
      game_id: gameId,
      score: score,
      details: details || {},
    };

    Mode.Debug.log(CONFIG.debugTag, '📤 提交成绩 [mode=' + storageMode + ']: ' + gameId + ', 玩家: ' + newRecord.player_name + ', 分数: ' + score);

    var ok = await pushRecord(newRecord);
    if (!ok) {
      showToast('❌ 成绩提交失败');
      return false;
    }

    // 成功！刷新排行榜
    cachedRecords = await fetchFromServer();
    refreshAll();
    var modeText = storageMode === 'supabase' ? '☁️ 云端' : (storageMode === 'netlify' ? '☁️ Netlify' : '💻 本地');
    showToast('✅ 成绩已提交（' + modeText + '）');
    // 本地模式时，额外给一条轻提示（不打断操作）
    if (storageMode === 'local') {
      setTimeout(function() {
        showToast('💡 提示: 本地排行榜仅你可见');
      }, 1800);
    }

    // 后台清理多余记录（静默处理，失败不影响用户）
    try {
      var games = Object.keys(GAMES);
      var needUpdate = false;
      var toDeleteIds = [];
      var keepRecords = [];

      for (var i = 0; i < games.length; i++) {
        var gid = games[i];
        var cfg = GAMES[gid];
        var filtered = cachedRecords.filter(function(r) { return r.game_id === gid; });
        filtered.sort(function(a, b) {
          return cfg.sortAsc ? a.score - b.score : b.score - a.score;
        });
        if (filtered.length > MAX_RECORDS) {
          needUpdate = true;
          // 保留前 MAX_RECORDS 条，其余标记为删除
          var toDelete = filtered.slice(MAX_RECORDS);
          for (var j = 0; j < toDelete.length; j++) {
            if (toDelete[j].id !== undefined) toDeleteIds.push(toDelete[j].id);
          }
        }
      }

      if (needUpdate) {
        if (storageMode === 'supabase' && supabase && toDeleteIds.length > 0) {
          // Supabase 模式: 按 ID 逐条删除
          for (var k = 0; k < toDeleteIds.length; k++) {
            try { await supabase.from(TABLE_NAME).delete().eq('id', toDeleteIds[k]); } catch(e) {}
          }
        } else if (storageMode === 'supabase-rest' && toDeleteIds.length > 0) {
          // Supabase REST 模式: 按 ID 逐条删除
          for (var k2 = 0; k2 < toDeleteIds.length; k2++) {
            try {
              await fetch(SUPABASE_URL + '/rest/v1/' + TABLE_NAME + '?id=eq.' + toDeleteIds[k2], {
                method: 'DELETE',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + SUPABASE_KEY,
                },
              });
            } catch(e) {}
          }
        } else {
          // Netlify/local 模式: 先构造保留记录，全量回写
          var games2 = Object.keys(GAMES);
          var trimmed = [];
          for (var m = 0; m < games2.length; m++) {
            var gid2 = games2[m];
            var cfg2 = GAMES[gid2];
            var filtered2 = cachedRecords.filter(function(r) { return r.game_id === gid2; });
            filtered2.sort(function(a, b) {
              return cfg2.sortAsc ? a.score - b.score : b.score - a.score;
            });
            trimmed = trimmed.concat(filtered2.slice(0, MAX_RECORDS));
          }
          if (storageMode === 'netlify') {
            await pushToNetlify(trimmed, newRecord.player_name);
          } else {
            pushToLocal(trimmed);
          }
        }
        // 清理后重新加载一次
        cachedRecords = await fetchFromServer();
        refreshAll();
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '清理记录时出错（不影响成绩）:', e.message);
    }

    return true;
  }

  /* ── 获取某游戏排名列表 ── */
  function getRankings(gameId) {
    var game = GAMES[gameId];
    if (!game) return [];
    var filtered = cachedRecords.filter(function(r) { return r.game_id === gameId; });
    filtered.sort(function(a, b) {
      return game.sortAsc ? a.score - b.score : b.score - a.score;
    });
    return filtered.slice(0, MAX_RECORDS);
  }

  /* ── Toast 提示 ── */
  function showToast(msg) {
    var existing = document.querySelector('.g4-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'g4-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 1500);
  }

  /* ── 清空排行榜 ── */
  async function clearRankings() {
    if (!confirm('确定要清空所有排行榜数据吗？（其他玩家的数据也会被清空）')) return;
    await deleteAllFromServer();
    cachedRecords = [];
    refreshAll();
  }

  /* ── 获取当前存储模式描述 ── */
  function getStorageMode() {
    return storageMode;
  }

  /* ── 存储模式文字描述 ── */
  function getStorageModeLabel() {
    switch (storageMode) {
      case 'supabase':      return '☁️ 云端同步';
      case 'supabase-rest': return '☁️ 云端同步';
      case 'netlify':       return '☁️ Netlify存储';
      case 'local':         return '💻 仅本地可见';
      default:              return '💻 本地';
    }
  }

  /* ── 刷新页面上所有排行榜 ── */
  function refreshAll() {
    ['game1', 'game2', 'game3'].forEach(function(gid) {
      var el = document.getElementById('lbList_' + gid);
      if (el) renderRankList(el, gid);
    });
    // 刷新所有排行榜区域的模式标签
    ['game1', 'game2', 'game3'].forEach(function(gid) {
      var modeEl = document.getElementById('lbMode_' + gid);
      if (modeEl) modeEl.textContent = getStorageModeLabel();
    });
  }

  /* ── 渲染排行榜到指定容器 ── */
  function renderRankList(listEl, gameId) {
    if (!listEl) return;
    var rankings = getRankings(gameId);

    if (rankings.length === 0) {
      listEl.innerHTML = '<div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无记录</div></div>';
      return;
    }

    var game = GAMES[gameId];
    var html = '';
    rankings.forEach(function(r, idx) {
      var rank = idx + 1;
      var topClass = rank === 1 ? ' top-1' : (rank === 2 ? ' top-2' : (rank === 3 ? ' top-3' : ''));
      var medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank));
      var detail = formatDetail(gameId, r.details);
      var scoreDisplay = game.sortAsc
        ? r.score + 'ms'
        : formatBigNumber(r.score);

      html += '<div class="g4-rank-item' + topClass + '">' +
        '<div class="g4-rank-num">' + medal + '</div>' +
        '<div class="g4-rank-info">' +
          '<div class="g4-rank-name">' + escapeHtml(r.player_name) + '</div>' +
          '<div class="g4-rank-detail">' + detail + '</div>' +
        '</div>' +
        '<div class="g4-rank-score">' + scoreDisplay + '</div>' +
      '</div>';
    });
    listEl.innerHTML = html;
  }

  /* ── 格式化详情 ── */
  function formatDetail(gameId, details) {
    if (!details) return '';
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch(e) { return details; }
    }
    switch (gameId) {
      case 'game1': return '准确率 ' + (details.accuracy || 0) + '% · ' + (details.difficulty || '简单');
      case 'game2': return '平均 ' + (details.avg || 0) + 'ms · ' + (details.mode || '普通');
      case 'game3': return '轮回 ' + (details.prestige || 0) + ' 次 · 倍率 x' + (details.multiplier || 1).toFixed(1);
      default: return '';
    }
  }

  /* ── 格式化大数字 ── */
  function formatBigNumber(val) {
    if (val >= 1e8) return (val / 1e8).toFixed(2) + 'Y';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return Math.floor(val).toString();
  }

  /* ── 转义 HTML ── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── 初始化 ── */
  async function init() {
    if (initialized) return;
    initialized = true;

    Mode.Debug.log(CONFIG.debugTag, '━━━━━━━━━━━━━━━━━━━━');
    Mode.Debug.log(CONFIG.debugTag, '🏁 排行榜模块启动中...');
    Mode.Debug.log(CONFIG.debugTag, '━━━━━━━━━━━━━━━━━━━━');

    // ============================================================
    // 强制使用 Netlify Function（删除所有降级逻辑）
    // ============================================================
    
    Mode.Debug.log(CONFIG.debugTag, '[强制模式] 测试 Netlify Function: ' + NETLIFY_ENDPOINT);
    const netlifyOk = await testNetlifyEndpoint();
    
    if (netlifyOk) {
      storageMode = 'netlify';
      Mode.Debug.log(CONFIG.debugTag, '✅ Netlify Function 就绪');
    } else {
      // 强制模式：Netlify Function 不可用则报错，不降级到本地
      Mode.Debug.error(CONFIG.debugTag, '❌ Netlify Function 不可用！排行榜功能将无法正常工作');
      throw new Error('Netlify Function 不可用，请检查部署');
    }

    Mode.Debug.log(CONFIG.debugTag, '━━━━━━━━━━━━━━━━━━━━');
    await loadData();
    startPolling();
    Mode.Debug.log(CONFIG.debugTag, '✅ 排行榜就绪 [模式: ' + storageMode + ', 记录: ' + cachedRecords.length + ']');
    Mode.Debug.log(CONFIG.debugTag, '━━━━━━━━━━━━━━━━━━━━');
  }

  Mode.ready(function() { init(); });

  return {
    init: init,
    submitScore: submitScore,
    getPlayerName: getPlayerName,
    setPlayerName: setPlayerName,
    renderRankList: renderRankList,
    refreshAll: refreshAll,
    clearRankings: clearRankings,
    getStorageMode: getStorageMode,
    getStorageModeLabel: getStorageModeLabel,
  };
})();