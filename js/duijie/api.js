/* ============================================================
   api.js — 三角洲行动 · 数据 API 层
   功能: 封装所有 API 调用 + 缓存策略 + 数据格式化
   依赖: mode.js (Mode 命名空间)
   使用: Mode.SjzApi.xxx()
   ════════════════════════════════════════════
   【结构说明】
   • 核心 API 代码（配置 / 缓存 / fetch 封装 / 各接口函数）
   ════════════════════════════════════════════
   【对接 API 端点文档】
   ────────────────────────────────────────────
   基础路径: /v1/sjz_api
   后端代理: proxy.php (本地) / .netlify/functions/proxy (生产)
   Token 注入: 由代理层自动拼接
   ────────────────────────────────────────────
   ① 卡战备（3h 缓存）
      GET /jzv3_zb         战备V3 (lv=0~5, 每档位单独请求, 过滤兑换组+排序取前10)
   ────────────────────────────────────────────
   ② 制造利润（每日 00:06 更新）
      GET /manufacturePro   各工作台制造利润
   ────────────────────────────────────────────
   ③ 每日地图密码（每日 00:06 更新）
      GET /map_pwd         所有地图密码
   ────────────────────────────────────────────
   ④ 图片资源
      GET {PIC_BASE}/{objectID}.png  物品贴图
   ────────────────────────────────────────────
   [CREATED: 2026-06-09] [SELF-CONTAINED]
   ============================================================ */

(function() {
  'use strict';

  /* ── 配置 ── */
  // 仅保留 3 个需要实时数据的 API 服务：卡战备 · 今日制造 · 每日密码
  // 价格/元数据/军需处/钥匙卡/子弹包/筛选项 全部从Supabase game_items 表读取（云端）
  var CONFIG = {
    // ── 3 个API服务的缓存键（仅用于清理遗留数据）──
    CACHE_BATTLE:       'sjz_battle',
    CACHE_MANUFACTURE:  'sjz_manufacture',
    CACHE_MAP_PWD:      'sjz_map_pwd',
  };

  /* ── 缓存工具（仅供 cache.clear 清理遗留数据）── */
  function clearCache(key) {
    Mode.clearStorage(key);
  }

  /* ── 从Supabase读取缓存数据（唯一数据源）── */
  function supabaseFetch(endpoint, logTag) {
    var url = '/.netlify/functions/api-reader?endpoint=' + encodeURIComponent(endpoint);
    Mode.Debug.log('SjzCache', '☁️ ' + (logTag || endpoint) + ' 从Supabase读取...');

    return fetch(url, {
      method: 'GET',
    }).then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    }).then(function(result) {
      if (result.ret === 0 && result.data) {
        Mode.Debug.log('SjzCache', '☁️ ' + (logTag || endpoint) + ' 读取成功，数据时间: ' + (result.updated_at || '未知'));
        return result.data;
      } else {
        Mode.Debug.warn('SjzCache', '⚠️ ' + (logTag || endpoint) + ' 无缓存数据: ' + (result.msg || ''));
        return null;
      }
    }).catch(function(err) {
      Mode.Debug.warn('SjzApi', '☁️ ' + (logTag || endpoint) + ' 读取失败: ' + err.message);
      return null;
    });
  }

  /* ── 格式化价格（带涨跌颜色 HTML）── */
  function formatPrice(price, jz) {
    var html = '<span class="sjz-price">' + Mode.formatCurrency(price) + '</span>';
    if (jz != null && jz !== 0) {
      var cls = jz > 0 ? 'sjz-up' : 'sjz-down';
      var sign = jz > 0 ? '+' : '';
      html += ' <span class="' + cls + '">(' + sign + Mode.formatCurrency(jz) + ')</span>';
    }
    return html;
  }

  /* ══════════════════════════════════════════════════════════════
     对接的 3 个服务：卡战备 · 今日制造 · 每日密码
     ══════════════════════════════════════════════════════════════ */

  /* ── 卡战备 V3（从Supabase读取，每档位单独API调用，已过滤兑换组+排序取前10）── */
  function fetchBattleV3ZB() {
    // 从Supabase读取（通过api-reader）
    return supabaseFetch('card_zhanbei', 'V3 战备').then(function(data) {
      if (data) {
        // 数据已经是处理好的格式：{0: {data: [...]}, 1: {...}, ...}
        Mode.Debug.log('Kazhanbei', '✅ V3 战备数据加载完成，根键名: [' + Object.keys(data).join(', ') + ']');
        return data;
      }
      // 如果Supabase无数据，返回空对象
      Mode.Debug.warn('SjzApi', 'V3 战备 无缓存数据');
      var empty = {};
      [0, 1, 2, 3, 5].forEach(function(lv) { empty[lv] = { data: [] }; });
      return empty;
    });
  }

  /* ── 今日制造利润（从Supabase读取，确保多设备一致）── */
  function fetchManufacture() {
    // 从Supabase读取（通过api-reader）
    return supabaseFetch('manufacture', '今日制造Pro').then(function(data) {
      if (data) {
        return data;
      }
      // 如果Supabase无数据，返回空对象
      Mode.Debug.warn('SjzApi', '今日制造Pro 无缓存数据');
      return { 1: [], 2: [], 3: [], 4: [] };
    });
  }

  /* ── 每日地图密码（从Supabase读取，确保多设备一致）── */
  function fetchMapPwd() {
    // 从Supabase读取（通过api-reader）
    return supabaseFetch('map_pwd', '每日密码').then(function(data) {
      if (data) {
        return data;
      }
      // 如果Supabase无数据，返回空对象
      Mode.Debug.warn('SjzApi', '每日密码 无缓存数据');
      return { a: [], b: [], c: [], d: [], e: [] };
    });
  }


  /* ── 初始化 ── */
  function init() {
    Mode.Debug.log('SjzApi', '═══════════ 数据来源清单 ═══════════');
    Mode.Debug.log('SjzApi', '🛡️  卡战备V3:   Mode.SjzApi.battleV4ZB()  — Supabase');
    Mode.Debug.log('SjzApi', '🔧  今日制造Pro: Mode.SjzApi.manufacture() — Supabase');
    Mode.Debug.log('SjzApi', '🔑  每日密码:    Mode.SjzApi.mapPwd()      — Supabase');
    Mode.Debug.log('SjzApi', '═══════════════════════════════════');
    Mode.Debug.log('SjzApi', '✅ API 层已加载（仅Supabase直读）');
  }

  /* ══════════════════════════════════════════════════════════
     以下返回核心 API 代码
     ══════════════════════════════════════════════════════════ */
  /* ── 暴露到 Mode 命名空间 ── */
  Mode.SjzApi = {
    CONFIG: CONFIG,

    // ── 🛡️ 卡战备（从Supabase读取，V3格式，已过滤兑换组+排序取前10）──
    battleV4ZB: fetchBattleV3ZB,
    battleV3ZB: fetchBattleV3ZB,  // 旧名兼容

    // ── 🔧 今日制造（每日00:06更新）──
    manufacture: fetchManufacture,

    // ── 🔑 每日地图密码（每日00:06更新）──
    mapPwd: fetchMapPwd,

    // ── 🗑️ 清理遗留的localStorage旧缓存（仅向后兼容）──
    cache: {
      clear: function() {
        var keys = ['sjz_battle', 'sjz_manufacture', 'sjz_map_pwd'];
        keys.forEach(function(k) { clearCache(k); });
        ['_v4_zb', '_v4_0', '_v4_all', '_all'].forEach(function(suffix) {
          keys.forEach(function(k) {
            if (k !== 'sjz_map_pwd') clearCache(k + suffix);
          });
        });
        // 清理旧格式
        for (var w = 1; w <= 4; w++) clearCache(CONFIG.CACHE_MANUFACTURE + '_' + w);
        // 清空所有 sjz_ / mode_ 前缀
        try {
          Object.keys(localStorage).forEach(function(key) {
            if (key.startsWith('sjz_') || key.startsWith('mode_')) localStorage.removeItem(key);
          });
        } catch(e) {}
        Mode.Debug.log('SjzApi', '✅ 前端旧缓存已清空');
      },
    },

    formatPrice: formatPrice,

    init: init,
  };

  // 自动初始化
  Mode.ready(function() {
    Mode.SjzApi.init();
  });

})();