/* ============================================================
   guanyu.js — 关于（英雄区）交互逻辑
   功能: 关于页面的动态内容渲染 + 管理员后台
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-10] [UPDATED: 2026-06-12]
   ============================================================ */

const GuanYu = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    debugTag: 'GuanYu',
    version: '5.0.2',
  };

  // 注意：卖AW和回收AW功能已迁移到AW子弹报价页面
  // 相关代码请参考 js/zuo/awm/awm.js

  /* ── 缓存管理面板状态 ── */
  let isCacheAdminLoggedIn = false;
  let cacheAdminPassword = '';
  let cacheStats = null;
  let pointsLogStats = null;

  /* ── 获取缓存管理器API地址 ── */
  function getCacheManagerApiUrl() {
    return 'api/cache-manager.php';
  }

  /* ── 加载缓存状态 ── */
  async function loadCacheStatus() {
    if (!isCacheAdminLoggedIn) return;
    
    try {
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=status';
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      if (data.ret === 0) {
        cacheStats = data;
        Mode.Debug.log(CONFIG.debugTag, '✅ 缓存状态已加载');
      } else {
        Mode.Debug.warn(CONFIG.debugTag, '缓存状态加载失败: ' + data.msg);
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '缓存状态请求失败: ' + e.message);
    }
  }

  /* ── 加载积分消耗日志 ── */
  async function loadPointsLog() {
    if (!isCacheAdminLoggedIn) return;
    
    try {
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=log_stats';
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      if (data.ret === 0) {
        pointsLogStats = data.stats;
        Mode.Debug.log(CONFIG.debugTag, '✅ 积分日志已加载');
      } else {
        Mode.Debug.warn(CONFIG.debugTag, '积分日志加载失败: ' + data.msg);
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '积分日志请求失败: ' + e.message);
    }
  }

  /* ── 显示积分日志弹窗 ── */
  function showPointsLogModal() {
    // 移除已存在的弹窗
    var existingModal = document.getElementById('pointsLogModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // 创建弹窗容器
    var modal = document.createElement('div');
    modal.id = 'pointsLogModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;';
    
    // 创建弹窗内容
    var content = document.createElement('div');
    content.style.cssText = 'background:#1a1a2e;border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5);';
    
    // 弹窗标题栏
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:rgba(74,222,128,0.1);border-bottom:1px solid rgba(255,255,255,0.1);';
    header.innerHTML = '<span style="font-size:18px;font-weight:600;color:#4ade80;">💰 积分消耗日志</span><button id="closePointsLogModal" style="background:rgba(255,100,100,0.2);border:none;color:#ff6b6b;font-size:20px;cursor:pointer;padding:4px 12px;border-radius:6px;">✕</button>';
    
    // 统计摘要
    var summary = document.createElement('div');
    summary.style.cssText = 'padding:16px 20px;background:rgba(255,255,255,0.05);';
    
    if (pointsLogStats) {
      var remainingPoints = pointsLogStats.remaining_points !== undefined ? pointsLogStats.remaining_points : '?';
      var totalConsumed = pointsLogStats.total_points_consumed !== undefined ? pointsLogStats.total_points_consumed : '?';
      summary.innerHTML = '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div style="flex:1;min-width:120px;text-align:center;padding:12px;background:rgba(74,222,128,0.15);border-radius:8px;border:1px solid rgba(74,222,128,0.3);">' +
        '<div style="font-size:28px;font-weight:700;color:#4ade80;">' + remainingPoints + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.6);">💰 剩余积分</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:12px;background:rgba(255,107,107,0.1);border-radius:8px;">' +
        '<div style="font-size:24px;font-weight:700;color:#ff6b6b;">' + totalConsumed + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.6);">已消耗积分</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:12px;background:rgba(255,107,107,0.1);border-radius:8px;">' +
        '<div style="font-size:24px;font-weight:700;color:#ff6b6b;">' + pointsLogStats.total_calls + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.6);">总消耗次数</div></div>' +
        '<div style="flex:1;min-width:100px;text-align:center;padding:12px;background:rgba(91,192,222,0.1);border-radius:8px;">' +
        '<div style="font-size:24px;font-weight:700;color:#5bc0de;">' + pointsLogStats.last_24h_calls + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.6);">最近24小时</div></div></div>' +
        // 同步剩余Token按钮
        '<div style="margin-top:12px;padding:12px;background:rgba(255,165,0,0.1);border-radius:8px;border:1px solid rgba(255,165,0,0.3);">' +
        '<div style="font-size:13px;color:#ffa500;margin-bottom:8px;">⚠️ 如果显示剩余与实际不符，可在此修正：</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<span style="font-size:13px;color:rgba(255,255,255,0.7);">实际剩余Token：</span>' +
        '<input id="syncRemainingInput" type="number" value="' + remainingPoints + '" style="flex:1;min-width:80px;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,165,0,0.4);background:rgba(0,0,0,0.3);color:#fff;font-size:14px;">' +
        '<button id="syncRemainingBtn" style="padding:6px 16px;background:#ffa500;border:none;border-radius:6px;color:#000;font-size:13px;font-weight:600;cursor:pointer;">同步</button>' +
        '<span id="syncRemainingStatus" style="font-size:12px;color:#4ade80;"></span>' +
        '</div></div>';
    } else {
      summary.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);">暂无数据</div>';
    }
    
    // 日志列表
    var logList = document.createElement('div');
    logList.style.cssText = 'padding:16px 20px;max-height:400px;overflow-y:auto;';
    
    if (pointsLogStats && pointsLogStats.logs && pointsLogStats.logs.length > 0) {
      logList.innerHTML = '<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-bottom:12px;">详细记录：</div>';
      
      pointsLogStats.logs.forEach(function(log) {
        var logItem = document.createElement('div');
        logItem.style.cssText = 'padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:3px solid #4ade80;';
        
        // 格式化时间
        var timeStr = log.time_str || '';
        if (log.timestamp) {
          var date = new Date(log.timestamp);
          timeStr = date.getFullYear() + '-' + 
            String(date.getMonth() + 1).padStart(2, '0') + '-' + 
            String(date.getDate()).padStart(2, '0') + ' ' +
            String(date.getHours()).padStart(2, '0') + ':' +
            String(date.getMinutes()).padStart(2, '0') + ':' +
            String(date.getSeconds()).padStart(2, '0');
        }
        
        // 格式化接口名称
        var endpointName = log.endpoint || '';
        var endpointDisplay = endpointName;
        if (endpointName.indexOf('/v1/sjz_api/map_pwd') !== -1) {
          endpointDisplay = '🔐 今日密码';
        } else if (endpointName.indexOf('/v1/sjz_api/manufacturePro') !== -1) {
          endpointDisplay = '🏭 今日制造';
        } else if (endpointName.indexOf('/v1/sjz_api/cardZhanbei') !== -1) {
          endpointDisplay = '⚔️ 卡战备方案';
        } else if (endpointName.indexOf('/v1/sjz_api/cardPrice') !== -1) {
          endpointDisplay = '💰 卡价格';
        }
        
        logItem.innerHTML = 
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
          '<span style="color:#f5b82e;font-size:13px;">' + timeStr + '</span>' +
          '<span style="color:rgba(255,255,255,0.8);font-size:14px;font-weight:500;">' + endpointDisplay + '</span>' +
          '<span style="color:#ff6b6b;font-size:14px;font-weight:600;">消耗 1 积分</span>' +
          '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">来源: ' + (log.type || 'cache-manager') + '</div>';
        
        logList.appendChild(logItem);
      });
    } else {
      logList.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);">暂无积分消耗记录</div>';
    }
    
    // 组装弹窗
    content.appendChild(header);
    content.appendChild(summary);
    content.appendChild(logList);
    modal.appendChild(content);
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    var closeBtn = document.getElementById('closePointsLogModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.remove();
      });
    }
    
    // 绑定同步剩余Token按钮
    var syncBtn = document.getElementById('syncRemainingBtn');
    var syncInput = document.getElementById('syncRemainingInput');
    var syncStatus = document.getElementById('syncRemainingStatus');
    if (syncBtn && syncInput) {
      syncBtn.addEventListener('click', async function() {
        var remaining = parseInt(syncInput.value);
        if (isNaN(remaining) || remaining < 0) {
          syncStatus.textContent = '❌ 请输入有效数字';
          syncStatus.style.color = '#ff6b6b';
          return;
        }
        syncBtn.disabled = true;
        syncBtn.textContent = '同步中...';
        syncStatus.textContent = '⏳';
        syncStatus.style.color = '#f5b82e';
        
        try {
          var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=sync_remaining&remaining=' + remaining;
          var res = await fetch(apiUrl);
          var data = await res.json();
          
          if (data.ret === 0) {
            syncStatus.textContent = '✅ 已同步！剩余:' + data.sync.remaining;
            syncStatus.style.color = '#4ade80';
            syncInput.value = data.sync.remaining;
            // 重新加载日志并2秒后自动刷新弹窗显示
            await loadPointsLog();
            setTimeout(function() {
              // 刷新弹窗显示最新数据
              var oldModal = document.getElementById('pointsLogModal');
              if (oldModal) oldModal.remove();
              showPointsLogModal();
            }, 1500);
          } else {
            syncStatus.textContent = '❌ ' + (data.msg || '同步失败');
            syncStatus.style.color = '#ff6b6b';
          }
        } catch (e) {
          syncStatus.textContent = '❌ 网络错误: ' + e.message;
          syncStatus.style.color = '#ff6b6b';
        }
        
        syncBtn.disabled = false;
        syncBtn.textContent = '同步';
      });
    }
    
    // 点击背景关闭
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /* ── 手动刷新缓存 ── */
  async function refreshCache() {
    if (!isCacheAdminLoggedIn) return;
    
    var btn = document.getElementById('btnRefreshCache');
    var statusEl = document.getElementById('cacheRefreshStatus');
    
    if (!btn || !statusEl) return;
    
    btn.disabled = true;
    btn.textContent = '🔄 刷新中...';
    statusEl.textContent = '正在预热缓存，请稍候...';
    statusEl.style.color = '#f5b82e';
    
    try {
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=refresh';
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      if (data.ret === 0) {
        statusEl.textContent = '✅ 缓存已刷新！消耗积分: ' + data.summary.points_used + ' | 成功: ' + data.summary.success + ' | 失败: ' + data.summary.failed;
        statusEl.style.color = '#4ade80';
        
        // 重新加载状态
        await loadCacheStatus();
        await loadPointsLog();
        
        // 重新渲染面板
        renderCacheManagerPanel();
        
        // 🆕 清理前端缓存并重新加载所有模块数据
        if (typeof Mode !== 'undefined' && Mode.SjzApi && Mode.SjzApi.cache && Mode.SjzApi.cache.clear) {
          Mode.SjzApi.cache.clear();
        }
        // 清除今日密码 promise 缓存
        window._mapPwdData = null;
        // 重新加载今日密码
        if (typeof Mima !== 'undefined' && Mima.refresh) {
          Mima.refresh();
        }
        // 重新加载今日制造
        if (typeof Mode !== 'undefined' && Mode.Zhizao && Mode.Zhizao.init) {
          Mode.Zhizao.init();
        }
        // 重新加载卡战备
        if (typeof Mode !== 'undefined' && Mode.Kazhanbei && Mode.Kazhanbei.refresh) {
          Mode.Kazhanbei.refresh();
        }

      } else {
        statusEl.textContent = '❌ 刷新失败: ' + data.msg;
        statusEl.style.color = '#ff6b6b';
      }
    } catch (e) {
      statusEl.textContent = '❌ 网络错误: ' + e.message;
      statusEl.style.color = '#ff6b6b';
    } finally {
      btn.disabled = false;
      btn.textContent = '🔥 刷新缓存';
    }
  }

  /* ── 工具：解包原始 API 数据（与 sjzFetch 逻辑一致）── */
  function unwrapApiData(rawData) {
    if (rawData && typeof rawData === 'object') {
      if (rawData.body !== undefined && typeof rawData.body === 'object' && !Array.isArray(rawData.body)) {
        return rawData.body;
      }
      if (rawData.data !== undefined && typeof rawData.data === 'object') {
        return rawData.data;
      }
      if (rawData.result !== undefined && typeof rawData.result === 'object') {
        return rawData.result;
      }
    }
    return rawData;
  }

  /* ── 刷新前端缓存并重新加载数据（直接读取本地SQLite）── */
  async function refreshFrontendCache(cacheType, rawData) {
    try {
      // 先清除内存中的 promise 缓存
      window._mapPwdData = null;
      if (typeof Mode !== 'undefined' && Mode.SjzApi && Mode.SjzApi.cache && Mode.SjzApi.cache.clear) {
        Mode.SjzApi.cache.clear();
      }

      // ✅ 无需写入localStorage —— 用户下次访问直接从Supabase获取最新数据
      
      switch (cacheType) {
        case 'map_pwd':
          if (typeof Mima !== 'undefined' && Mima.refresh) {
            Mima.refresh();
          } else if (typeof Mima !== 'undefined' && Mima.init) {
            Mima.init();
          }
          break;
        case 'manufacture':
          if (typeof Mode !== 'undefined' && Mode.Zhizao && Mode.Zhizao.init) {
            Mode.Zhizao.init();
          }
          break;
        case 'card_zhanbei':
          if (typeof Mode !== 'undefined' && Mode.Kazhanbei && Mode.Kazhanbei.refresh) {
            Mode.Kazhanbei.refresh();
          } else if (typeof Mode !== 'undefined' && Mode.Kazhanbei && Mode.Kazhanbei.init) {
            Mode.Kazhanbei.init();
          }
          break;
      }
      
      Mode.Debug.log('GuanYu', '✅ 前端缓存已刷新，页面数据已更新');
    } catch (e) {
      Mode.Debug.error('GuanYu', '刷新前端缓存失败:', e.message);
    }
  }

  /* ── 刷新单个缓存 ── */
  async function refreshSingleCache(cacheType) {
    if (!isCacheAdminLoggedIn) return;
    
    var statusEl = document.getElementById('cacheRefreshStatus');
    if (!statusEl) return;
    
    // 获取对应的按钮
    var btnId = '';
    var btnText = '';
    var endpoint = '';
    
    switch (cacheType) {
      case 'map_pwd':
        btnId = 'btnRefreshMapPwd';
        btnText = '🔐 获取今日密码';
        endpoint = 'map_pwd';
        break;
      case 'manufacture':
        btnId = 'btnRefreshManufacture';
        btnText = '🏭 获取今日制造';
        endpoint = 'manufacture';
        break;
      case 'card_zhanbei':
        btnId = 'btnRefreshCardZhanbei';
        btnText = '⚔️ 获取卡战备方案';
        endpoint = 'card_zhanbei';
        break;
      default:
        return;
    }
    
    var btn = document.getElementById(btnId);
    if (!btn) return;
    
    btn.disabled = true;
    btn.textContent = '🔄 加载中...';
    statusEl.textContent = '正在获取 ' + btnText + '...';
    statusEl.style.color = '#f5b82e';
    
    try {
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=refresh_single&endpoint=' + endpoint;
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      if (data.ret === 0) {
        // 显示成功信息
        var pointsInfo = '✅ ' + btnText + ' 成功！消耗积分: ' + (data.points_used || 0);
        statusEl.textContent = pointsInfo;
        statusEl.style.color = '#4ade80';

        // 🆕 显示返回的数据内容
        if (data.raw_data) {
          showRefreshResultData(cacheType, data.raw_data);
        }
        
        // 通知前端重新加载该缓存数据（用户下次访问从本地SQLite获取）
        console.log('[GuanYu] 📦 cache-manager 返回原始数据:', JSON.stringify(data, null, 2));
        await refreshFrontendCache(cacheType, data.raw_data || null);
        
        // 重新加载状态和日志
        await loadCacheStatus();
        await loadPointsLog();
        renderCacheManagerPanel();
      } else {
        statusEl.textContent = '❌ ' + btnText + ' 失败: ' + data.msg;
        statusEl.style.color = '#ff6b6b';
      }
        /* ── 🆕 展示刷新结果数据 ── */
  function showRefreshResultData(cacheType, rawData) {
    try {
      var title = '';
      var content = '';

      switch (cacheType) {
        case 'map_pwd':
          title = '🔐 今日密码';
          content = formatMapPwdData(rawData);
          break;
        case 'manufacture':
          title = '🏭 今日制造';
          content = formatManufactureData(rawData);
          break;
        case 'card_zhanbei':
          title = '⚔️ 卡战备方案';
          content = formatCardZhanbeiData(rawData);
          break;
        default:
          return;
      }

      // 显示结果弹窗
      showResultModal(title, content);
    } catch (e) {
      Mode.Debug.error('GuanYu', '展示刷新结果失败:', e.message);
    }
  }

  /* ── 🆕 格式化今日密码数据 ── */
  function formatMapPwdData(data) {
    // 打印原始数据到控制台，方便调试
    console.log('[GuanYu] 🔐 map_pwd 原始数据:', JSON.stringify(data, null, 2));

    // 解包：兼容 ret/body/data 等包装格式
    var unwrapped = data;
    if (data && typeof data === 'object') {
      // 格式: {ret: 0, body: {...}}
      if (data.body !== undefined && typeof data.body === 'object' && !Array.isArray(data.body)) {
        unwrapped = data.body;
      }
      // 格式: {ret: 0, data: {...}}
      else if (data.data !== undefined && typeof data.data === 'object' && !Array.isArray(data.data)) {
        unwrapped = data.data;
      }
      // 格式: {ret: 0, msg: '...', result: {...}}
      else if (data.result !== undefined && typeof data.result === 'object') {
        unwrapped = data.result;
      }
      // 格式: {ret: 0, msg: '...', ...} (不包含 body/data/result 但有 ret)
      else if (data.ret !== undefined) {
        // 删除 ret 和 msg 字段，看剩下的
        var cleaned = {};
        for (var k in data) {
          if (k !== 'ret' && k !== 'msg' && k !== 'message' && data.hasOwnProperty(k)) {
            cleaned[k] = data[k];
          }
        }
        if (Object.keys(cleaned).length > 0) {
          unwrapped = cleaned;
        }
      }
    }

    console.log('[GuanYu] 🔐 map_pwd 解包后数据:', JSON.stringify(unwrapped, null, 2));

    var html = '<div style="padding:10px;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.2);text-align:left;color:#FFD700;">地图</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.2);text-align:left;color:#FF6B9D;">密码</th></tr>';

    var mapNames = ['零号大坝', '长弓溪谷', '攀升', '航站楼', '潮汐监狱'];
    var pwdFound = false;

    if (unwrapped && typeof unwrapped === 'object') {
      var mapKeys = ['a', 'b', 'c', 'd', 'e'];
      for (var i = 0; i < mapKeys.length; i++) {
        var pwd = '';
        if (unwrapped[mapKeys[i]] && Array.isArray(unwrapped[mapKeys[i]])) {
          pwd = unwrapped[mapKeys[i]][0] || '--';
        } else if (unwrapped['map_' + (i + 1)]) {
          pwd = unwrapped['map_' + (i + 1)] || '--';
        } else if (unwrapped.passwords && unwrapped.passwords[i]) {
          pwd = unwrapped.passwords[i].password || unwrapped.passwords[i].pwd || unwrapped.passwords[i].code || '--';
        } else if (unwrapped.data && unwrapped.data.passwords && unwrapped.data.passwords[i]) {
          pwd = unwrapped.data.passwords[i].password || unwrapped.data.passwords[i].pwd || '--';
        } else {
          continue;
        }
        html += '<tr><td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);color:#fff;">' + mapNames[i] + '</td>';
        html += '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.1);color:#FF0000;font-family:KaiTi,serif;font-size:24px;font-weight:bold;">' + pwd + '</td></tr>';
        pwdFound = true;
      }
    }

    if (!pwdFound) {
      html += '<tr><td colspan="2" style="padding:20px;text-align:center;color:rgba(255,255,255,0.5);">未找到密码数据</td></tr>';
    }

    html += '</table></div>';
    return html;
  }

  /* ── 🆕 格式化今日制造数据 ── */
  function formatManufactureData(data) {
    var html = '<div style="padding:10px;max-height:400px;overflow-y:auto;">';

    // 收集所有物品
    var allItems = [];

    if (Array.isArray(data)) {
      data.forEach(function(item) {
        // 格式1: 直接是物品 {name, price, pic}
        if (item.name || item.price !== undefined) {
          allItems.push(item);
        }
        // 格式2: 工作台包装 {workshop, items: [{name, price, pic}, ...]}
        else if (item.items && Array.isArray(item.items)) {
          item.items.forEach(function(sub) { allItems.push(sub); });
        }
        // 格式3: 工作台包装 {t, data: [...]}
        else if (item.data && Array.isArray(item.data)) {
          item.data.forEach(function(sub) { allItems.push(sub); });
        }
      });
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      // 格式4: 对象 {1: [{...}, ...], 2: [...]}
      Object.keys(data).forEach(function(k) {
        if (Array.isArray(data[k])) {
          data[k].forEach(function(sub) { allItems.push(sub); });
        }
      });
    }

    if (allItems.length > 0) {
      var sorted = allItems.sort(function(a, b) {
        return (b.price || 0) - (a.price || 0);
      });

      sorted.forEach(function(item) {
        html += '<div style="display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:8px;">';
        if (item.pic) {
          html += '<img src="' + item.pic + '" style="width:48px;height:48px;border-radius:4px;object-fit:contain;">';
        }
        html += '<div style="flex:1;">';
        html += '<div style="color:#F5D742;font-weight:600;">' + (item.name || '未知') + '</div>';
        html += '<div style="color:rgba(255,255,255,0.6);font-size:12px;">价值: <span style="color:' + ((item.price || 0) >= 0 ? '#4ade80' : '#ff6b6b') + ';font-weight:600;">' + (item.price || 0) + '</span></div>';
        html += '</div></div>';
      });
    } else {
      html += '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">暂无制造数据</div>';
    }

    html += '</div>';
    return html;
  }

  /* ── 🆕 格式化卡战备数据 ── */
  function formatCardZhanbeiData(data) {
    var html = '<div style="padding:10px;max-height:400px;overflow-y:auto;">';

    if (data && typeof data === 'object') {
      var keys = Object.keys(data);
      if (keys.length > 0) {
        keys.forEach(function(key) {
          var value = data[key];
          html += '<div style="margin-bottom:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;">';
          html += '<div style="color:#fd79a8;font-weight:600;margin-bottom:8px;">💰 ' + key + '</div>';

          if (Array.isArray(value)) {
            value.forEach(function(item) {
              if (typeof item === 'object' && item !== null) {
                html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;">';
                if (item.icon) html += '<img src="' + item.icon + '" style="width:24px;height:24px;">';
                html += '<span style="color:#fff;">' + (item.name || item.label || JSON.stringify(item)) + '</span>';
                if (item.price || item.count) {
                  html += '<span style="color:#F5D742;margin-left:auto;">' + (item.price || item.count) + '</span>';
                }
                html += '</div>';
              } else {
                html += '<div style="color:rgba(255,255,255,0.7);padding:2px 0;font-size:13px;">• ' + item + '</div>';
              }
            });
          } else if (typeof value === 'object' && value !== null) {
            Object.keys(value).forEach(function(subKey) {
              html += '<div style="color:rgba(255,255,255,0.7);padding:2px 0;font-size:13px;">• ' + subKey + ': ' + JSON.stringify(value[subKey]) + '</div>';
            });
          } else {
            html += '<div style="color:rgba(255,255,255,0.7);font-size:13px;">' + value + '</div>';
          }
          html += '</div>';
        });
      } else {
        html += '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">暂无战备数据</div>';
      }
    } else {
      html += '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.5);">暂无战备数据</div>';
    }

    html += '</div>';
    return html;
  }

  /* ── 🆕 显示结果弹窗 ── */
  function showResultModal(title, contentHtml) {
    // 移除已存在的弹窗
    var existingModal = document.getElementById('refreshResultModal');
    if (existingModal) existingModal.remove();

    var modal = document.createElement('div');
    modal.id = 'refreshResultModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);';

    modal.innerHTML = '<div style="background:linear-gradient(145deg,#1a1a2e,#16213e);border:1px solid rgba(91,192,222,0.3);border-radius:16px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);">' +
      '<h2 style="margin:0;color:#fff;font-size:18px;">' + title + ' — 最新数据</h2>' +
      '<button id="closeRefreshResultBtn" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:24px;cursor:pointer;padding:0 4px;">×</button>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;">' + contentHtml + '</div>' +
      '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">' +
      '<span style="color:rgba(255,255,255,0.4);font-size:12px;">💡 数据已同步更新到缓存，前端页面将在下次加载时显示新数据</span>' +
      '</div></div>';

    document.body.appendChild(modal);

    // 绑定关闭事件
    var closeBtn = document.getElementById('closeRefreshResultBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.remove();
      });
    }

    // 点击背景关闭
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
    } catch (e) {
      statusEl.textContent = '❌ 网络错误: ' + e.message;
      statusEl.style.color = '#ff6b6b';
    } finally {
      btn.disabled = false;
      btn.textContent = btnText;
    }
  }

  /* ── 清空缓存 ── */
  async function clearCache(event) {
    // 阻止默认行为（防止表单提交导致页面刷新）
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!isCacheAdminLoggedIn) return;
    
    var btn = document.getElementById('btnClearCache');
    var statusEl = document.getElementById('cacheRefreshStatus');
    
    if (!btn || !statusEl) return;
    
    if (!confirm('⚠️ 确定要清空所有缓存吗？清空后用户将无法访问数据，直到管理员手动刷新缓存。')) {
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '🗑️ 清空中...';
    statusEl.textContent = '正在清空缓存...';
    statusEl.style.color = '#f5b82e';
    
    try {
      // 1. 清空服务器端缓存（Netlify Blobs）
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=clear';
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      // 2. 清空前端缓存（Mode.SjzApi）
      if (typeof Mode !== 'undefined' && Mode.SjzApi && Mode.SjzApi.cache && Mode.SjzApi.cache.clear) {
        Mode.SjzApi.cache.clear();
      }
      
      // 4. 提示用户刷新页面以清空内存缓存
      if (data.ret === 0) {
        statusEl.innerHTML = '✅ 服务器端 + 前端缓存已全部清空！<br><span style="font-size:12px;color:rgba(255,255,255,0.6);">💡 请按 Ctrl+F5 强制刷新页面以清空内存缓存</span>';
      } else {
        statusEl.innerHTML = '✅ 前端缓存已清空！<br><span style="font-size:12px;color:rgba(255,255,255,0.6);">💡 请按 Ctrl+F5 强制刷新页面。服务器端: ' + data.msg + '</span>';
      }
      statusEl.style.color = '#4ade80';
      
      // 重新加载状态
      await loadCacheStatus();
      
      // 重新渲染面板
      renderCacheManagerPanel();
    } catch (e) {
      statusEl.textContent = '❌ 清空失败: ' + e.message;
      statusEl.style.color = '#ff6b6b';
    } finally {
      btn.disabled = false;
      btn.textContent = '🗑️ 清空缓存';
    }
  }

  /* ── 删除单个缓存 ── */
  async function deleteSingleCache(cacheId) {
    if (!isCacheAdminLoggedIn) return;
    
    var nameMap = {
      'map_pwd': '今日密码',
      'manufacture': '今日制造',
      'card_zhanbei': '卡战备方案',
    };
    var name = nameMap[cacheId] || cacheId;
    
    if (!confirm('⚠️ 确定要删除「' + name + '」缓存吗？删除后该模块将无法访问数据，直到手动刷新。')) {
      return;
    }
    
    var btn = document.getElementById('btnDelete' + cacheId.charAt(0).toUpperCase() + cacheId.slice(1));
    var statusEl = document.getElementById('cacheRefreshStatus');
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ 删除中...';
    }
    if (statusEl) {
      statusEl.textContent = '正在删除「' + name + '」缓存...';
      statusEl.style.color = '#f5b82e';
    }
    
    try {
      var apiUrl = getCacheManagerApiUrl() + '?admin_key=' + encodeURIComponent(cacheAdminPassword) + '&action=clear_single&cache_id=' + cacheId;
      var res = await fetch(apiUrl);
      var data = await res.json();
      
      if (data.ret === 0) {
        if (statusEl) {
          statusEl.textContent = '✅ 已删除「' + name + '」缓存！';
          statusEl.style.color = '#4ade80';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = '❌ 删除失败: ' + data.msg;
          statusEl.style.color = '#ff6b6b';
        }
      }
      
      // 重新加载状态
      await loadCacheStatus();
      renderCacheManagerPanel();
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = '❌ 删除失败: ' + e.message;
        statusEl.style.color = '#ff6b6b';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🗑️ 删除' + name;
      }
    }
  }

  /* ── 渲染缓存管理面板 ── */
  function renderCacheManagerPanel() {
    var html = '<div class="guanyu-card cache-manager-card" style="margin-top:20px;">';
    html += '<div class="guanyu-card-title" style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span>⚡ 缓存管理 & 积分监控</span>';
    if (isCacheAdminLoggedIn) {
      html += '<button id="cacheLogoutBtn" class="admin-toggle-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;flex-shrink:0;font-size:12px;padding:4px 10px;">🔐 退出</button>';
    } else {
      html += '<button id="cacheLoginBtn" class="admin-toggle-btn" style="flex-shrink:0;font-size:12px;padding:4px 10px;">🔧 管理员登录</button>';
    }
    html += '</div>';

    // 登录面板（未登录时显示）
    if (!isCacheAdminLoggedIn) {
      html += '<div id="cacheLoginPanel" class="admin-panel" style="display:none;">';
      html += '<div class="admin-panel-title">🔧 缓存管理员登录</div>';
      html += '<div class="admin-row" style="display:flex;gap:10px;flex-wrap:wrap;">';
      html += '<input id="cacheLoginPass" type="password" placeholder="请输入管理员密码" class="admin-input" style="flex:1;min-width:120px;">';
      html += '<button id="btnCacheLogin" class="admin-submit-btn">登录</button>';
      html += '</div>';
      html += '<div id="cacheLoginStatus" class="admin-status" style="color:#ff6b6b;"></div>';
      html += '</div>';
      html += '</div>'; // 闭合缓存管理卡片
      return html;
    }

    // 已登录：显示管理面板
    html += '<div style="padding:12px;">';
    
    // 状态提示区
    html += '<div id="cacheRefreshStatus" class="admin-status" style="margin-bottom:16px;"></div>';
    
    // 快捷操作按钮区（第一行）
    html += '<div class="admin-panel" style="margin-bottom:16px;">';
    html += '<div class="admin-panel-title">⚙️ 快捷操作</div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">';
    html += '<button type="button" id="btnClearCache" class="admin-submit-btn" style="background:#ff6b6b;">🗑️ 清空缓存</button>';
    html += '<button type="button" id="btnRefreshCache" class="admin-submit-btn" style="background:#4ade80;">🔥 刷新所有缓存</button>';
    html += '<button type="button" id="btnLoadLog" class="admin-submit-btn" style="background:#5bc0de;">📊 查看积分日志</button>';
    html += '</div>';
    html += '</div>';
    
    // 独立缓存控制区（第二行：删除 + 获取）
    html += '<div class="admin-panel" style="margin-bottom:16px;">';
    html += '<div class="admin-panel-title">🎯 独立缓存控制</div>';
    // 第一行：删除按钮
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;margin-bottom:8px;">';
    html += '<button type="button" id="btnDeleteMapPwd" class="admin-submit-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;border:1px solid rgba(255,100,100,0.3);">🗑️ 删除今日密码</button>';
    html += '<button type="button" id="btnDeleteManufacture" class="admin-submit-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;border:1px solid rgba(255,100,100,0.3);">🗑️ 删除今日制造</button>';
    html += '<button type="button" id="btnDeleteCardZhanbei" class="admin-submit-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;border:1px solid rgba(255,100,100,0.3);">🗑️ 删除卡战备方案</button>';
    html += '</div>';
    // 第二行：获取按钮
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
    html += '<button type="button" id="btnRefreshMapPwd" class="admin-submit-btn" style="background:#9c88ff;">🔐 获取今日密码</button>';
    html += '<button type="button" id="btnRefreshManufacture" class="admin-submit-btn" style="background:#00cec9;">🏭 获取今日制造</button>';
    html += '<button type="button" id="btnRefreshCardZhanbei" class="admin-submit-btn" style="background:#fd79a8;">⚔️ 获取卡战备方案</button>';
    html += '</div>';
    html += '</div>';
    
    // 缓存状态统计
    if (cacheStats && cacheStats.summary) {
      html += '<div class="admin-panel" style="margin-bottom:16px;">';
      html += '<div class="admin-panel-title">📈 缓存覆盖率</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">';
      html += '<div style="text-align:center;padding:12px;background:rgba(74,222,128,0.1);border-radius:8px;">';
      html += '<div style="font-size:24px;font-weight:700;color:#4ade80;">' + cacheStats.summary.coverage + '</div>';
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);">覆盖率</div>';
      html += '</div>';
      html += '<div style="text-align:center;padding:12px;background:rgba(245,184,46,0.1);border-radius:8px;">';
      html += '<div style="font-size:24px;font-weight:700;color:#f5b82e;">' + cacheStats.summary.cached + '/' + cacheStats.summary.total_endpoints + '</div>';
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);">已缓存接口</div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }
    
    // 积分消耗日志统计
    if (pointsLogStats) {
      html += '<div class="admin-panel" style="margin-bottom:16px;">';
      html += '<div class="admin-panel-title">💰 积分消耗统计</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">';
      html += '<div style="text-align:center;padding:12px;background:rgba(255,107,107,0.1);border-radius:8px;">';
      html += '<div style="font-size:24px;font-weight:700;color:#ff6b6b;">' + pointsLogStats.total_calls + '</div>';
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);">总消耗次数</div>';
      html += '</div>';
      html += '<div style="text-align:center;padding:12px;background:rgba(91,192,222,0.1);border-radius:8px;">';
      html += '<div style="font-size:24px;font-weight:700;color:#5bc0de;">' + pointsLogStats.last_24h_calls + '</div>';
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.6);">最近24小时</div>';
      html += '</div>';
      html += '</div>';
      
      // 最近消耗记录
      if (pointsLogStats.logs && pointsLogStats.logs.length > 0) {
        html += '<div style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.7);">最近消耗记录：</div>';
        html += '<div style="max-height:200px;overflow-y:auto;font-size:11px;">';
        pointsLogStats.logs.slice(0, 10).forEach(function(log) {
          html += '<div style="padding:6px;margin-top:4px;background:rgba(255,255,255,0.05);border-radius:4px;">';
          html += '<span style="color:#f5b82e;">' + log.time_str + '</span> ';
          html += '<span style="color:rgba(255,255,255,0.6);">' + log.endpoint + '</span> ';
          html += '<span style="color:#ff6b6b;">(' + log.type + ')</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    return html;
  }

  /* ── 缓存管理登录 ── */
  function doCacheLogin() {
    var passInput = document.getElementById('cacheLoginPass');
    var statusEl = document.getElementById('cacheLoginStatus');
    var pass = passInput?.value || '';

    if (!pass) {
      statusEl.textContent = '❌ 请输入管理员密码';
      return;
    }

    // 使用订单API验证密码（与订单管理登录逻辑一致）
    var apiUrl = 'api/orders.php';

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bullet_count: -1,
        total_price: -1,
        admin_pass: pass,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.msg === '总价无效' || result.msg === '子弹数量无效') {
          // 密码正确（通过了密码校验，只是价格/数量校验失败）
          isCacheAdminLoggedIn = true;
          cacheAdminPassword = pass;
          if (passInput) passInput.value = '';
          statusEl.textContent = '✅ 登录成功';
          statusEl.style.color = '#4ade80';
          
          // 加载缓存状态和积分日志
          loadCacheStatus();
          loadPointsLog();
          
          // 重新渲染
          render();
        } else if (result.msg === '管理员密码错误') {
          statusEl.textContent = '❌ 密码错误';
          statusEl.style.color = '#ff6b6b';
        } else {
          statusEl.textContent = '❌ 验证失败：' + (result.msg || '未知错误');
          statusEl.style.color = '#ff6b6b';
        }
      })
      .catch(function(err) {
        statusEl.textContent = '❌ 网络错误: ' + err.message;
        statusEl.style.color = '#ff6b6b';
      });
  }

  /* ── 缓存管理退出登录 ── */
  function doCacheLogout() {
    isCacheAdminLoggedIn = false;
    cacheAdminPassword = '';
    cacheStats = null;
    pointsLogStats = null;
    render();
  }

  /* ── 渲染整个页面 ─ */
  function render() {
    var container = document.getElementById('guanyuContent');
    if (!container) return;

    var htmlTop =
      '<div style="text-align:center;">' +
        '<div class="guanyu-card" style="display:inline-block;padding:4px;">' +
          '<img src="photo/shoukunama/zanshangma.jpg" alt="赞赏码" style="width:360px;height:360px;border-radius:8px;display:block;">' +
        '</div>' +
      '</div>' +
      '<div class="guanyu-card-text" style="text-align:center;font-size:26px;margin:12px 0 16px;">感谢您的每一份支持与鼓励 🙏</div>';

    // ⚡ 缓存管理面板
    var htmlCachePanel = renderCacheManagerPanel();

    var htmlBottom =
      '<div class="guanyu-card">' +
        '<div class="guanyu-card-title">👨‍💻 开发团队</div>' +
        '<div class="guanyu-card-text">' +
          '感谢 <strong style="color:#f5b82e;">章鱼哥</strong> 创建及维护<br>' +
          '感谢 <strong style="color:#f5b82e;">海绵宝宝</strong> 提供资金支持<br>' +
          '感谢 <strong style="color:#f5b82e;">派大星</strong> 提供高防服务器' +
        '</div>' +
      '</div>' +
      '<div class="guanyu-card">' +
        '<div class="guanyu-card-title">📬 联系我们</div>' +
        '<div class="guanyu-card-text">' +
          '如有问题或建议，欢迎加入我们的玩家社区交流反馈。' +
        '</div>' +
      '</div>' +
      '<div class="guanyu-version">' +
        '版本 <span>v' + CONFIG.version + '</span>  |  © 2026 比奇堡工作室' +
      '</div>';

    container.innerHTML = htmlTop + htmlCachePanel + htmlBottom;

    // ★ 缓存面板事件绑定
    bindCacheEvents();
  }

  /* ── 缓存面板事件绑定（只在 render() 中调用一次）── */
  function bindCacheEvents() {
    // 缓存登录按钮
    var cacheLoginBtn = document.getElementById('cacheLoginBtn');
    if (cacheLoginBtn) {
      cacheLoginBtn.addEventListener('click', function() {
        var panel = document.getElementById('cacheLoginPanel');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });
    }

    // ★ 缓存密码框回车登录
    var cacheLoginPass = document.getElementById('cacheLoginPass');
    if (cacheLoginPass) {
      cacheLoginPass.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') doCacheLogin();
      });
    }

    // 执行缓存登录
    var btnCacheLogin = document.getElementById('btnCacheLogin');
    if (btnCacheLogin) {
      btnCacheLogin.addEventListener('click', doCacheLogin);
    }

    // 缓存退出登录
    var cacheLogoutBtn = document.getElementById('cacheLogoutBtn');
    if (cacheLogoutBtn) {
      cacheLogoutBtn.addEventListener('click', doCacheLogout);
    }

    // 刷新缓存
    var btnRefreshCache = document.getElementById('btnRefreshCache');
    if (btnRefreshCache) {
      btnRefreshCache.addEventListener('click', refreshCache);
    }

    // 清空缓存
    var btnClearCache = document.getElementById('btnClearCache');
    if (btnClearCache) {
      btnClearCache.addEventListener('click', clearCache);
    }

    // 查看积分日志（弹窗显示）
    var btnLoadLog = document.getElementById('btnLoadLog');
    if (btnLoadLog) {
      btnLoadLog.addEventListener('click', async function() {
        await loadPointsLog();
        showPointsLogModal();
      });
    }

    // 独立缓存控制按钮
    // 获取今日密码
    var btnRefreshMapPwd = document.getElementById('btnRefreshMapPwd');
    if (btnRefreshMapPwd) {
      btnRefreshMapPwd.addEventListener('click', function() {
        refreshSingleCache('map_pwd');
      });
    }

    // 获取今日制造
    var btnRefreshManufacture = document.getElementById('btnRefreshManufacture');
    if (btnRefreshManufacture) {
      btnRefreshManufacture.addEventListener('click', function() {
        refreshSingleCache('manufacture');
      });
    }

    // 获取卡战备方案
    var btnRefreshCardZhanbei = document.getElementById('btnRefreshCardZhanbei');
    if (btnRefreshCardZhanbei) {
      btnRefreshCardZhanbei.addEventListener('click', function() {
        refreshSingleCache('card_zhanbei');
      });
    }

    // 删除单个缓存按钮
    var btnDeleteMapPwd = document.getElementById('btnDeleteMapPwd');
    if (btnDeleteMapPwd) {
      btnDeleteMapPwd.addEventListener('click', function() {
        deleteSingleCache('map_pwd');
      });
    }

    var btnDeleteManufacture = document.getElementById('btnDeleteManufacture');
    if (btnDeleteManufacture) {
      btnDeleteManufacture.addEventListener('click', function() {
        deleteSingleCache('manufacture');
      });
    }

    var btnDeleteCardZhanbei = document.getElementById('btnDeleteCardZhanbei');
    if (btnDeleteCardZhanbei) {
      btnDeleteCardZhanbei.addEventListener('click', function() {
        deleteSingleCache('card_zhanbei');
      });
    }
  }

  // 注意：卖AW和回收AW的事件绑定已迁移到 AW子弹报价页面
  // 相关代码请参考 js/zuo/awm/awm.js

  /* ── 初始化 ── */
  function init() {
    try {
      render();
      Mode.Debug.log(CONFIG.debugTag, '关于模块已就绪 ✅');
    } catch (e) {
      console.error('[GuanYu] init 失败:', e);
      Mode.Debug.error(CONFIG.debugTag, 'init 失败: ' + e.message);
      // 即使出错也尝试显示基本内容
      var container = document.getElementById('guanyuContent');
      if (container) {
        var errMsg = String(e.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      container.innerHTML = '<div class="guanyu-card" style="padding:24px;text-align:center;">'
        + '<div style="color:#ff6b6b;font-size:18px;margin-bottom:12px;">❌ 页面加载出错</div>'
        + '<div style="color:rgba(255,255,255,0.5);font-size:14px;">' + errMsg + '</div>'
        + '</div>';
      }
    }
  }

  /* ── 重新渲染（用于页面切换后刷新数据） ── */
  function reRender() {
    var container = document.getElementById('guanyuContent');
    if (container) {
      container.innerHTML = '';
      render();
      Mode.Debug.log(CONFIG.debugTag, '关于页面已重新渲染');
    } else {
      Mode.Debug.warn(CONFIG.debugTag, 'guanyuContent 元素不存在，无法重新渲染');
    }
  }

  /* ── 公开 API ── */
  return {
    init,
    reRender,
  };
})();

// ★ 关键修复：挂载到 window，让 zuo.js 的 switchMainContent 能访问到
window.GuanYu = GuanYu;

/* 页面就绪后自动启动 */
Mode.ready(function () {
  GuanYu.init();
});