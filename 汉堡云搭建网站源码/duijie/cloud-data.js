/* ============================================================
   cloud-data.js — 比奇堡报价单 · 云端数据层
   功能: 统一封装所有云端数据的读写操作
   替代: 原 bqb_data.js 静态文件 + 各模块localStorage存储
   依赖: mode.js (Mode 命名空间)
   ============================================================ */

(function() {
  'use strict';

  /* ── 获取API基础路径（虚拟主机使用 PHP 文件） ── */
  function getApiBase() {
    return 'api';
  }

  /* ══════════════════════════════════════════════════════════════
     ① 物品数据（原 bqb_data.js）
     ══════════════════════════════════════════════════════════════ */

  var _itemsCache = null;
  var _itemsLoading = false;
  var _itemsCallbacks = [];

  /* ── 从云端加载全部物品数据 ── */
  function loadItemsFromCloud() {
    if (_itemsCache) {
      // 已有缓存，直接返回
      return Promise.resolve(_itemsCache);
    }

    if (_itemsLoading) {
      // 正在加载中，返回一个等待中的Promise
      return new Promise(function(resolve) {
        _itemsCallbacks.push(resolve);
      });
    }

    _itemsLoading = true;
    Mode.Debug.log('CloudData', '☁️ 从云端加载物品数据...');

    var url = getApiBase() + '/items.php?limit=5000';

    return fetch(url, {
      method: 'GET',
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(result) {
      if (result.ret === 0 && result.data) {
        _itemsCache = result.data;
        Mode.Debug.log('CloudData', '✅ 物品数据加载完成: ' + result.data.length + ' 条');

        // 写入全局变量（兼容旧代码 window.item_info_all）
        window.item_info_all = result.data;

        // 构建 BQB_INITIAL_DATA 兼容结构（原 bqb_data.js 提供）
        buildInitialData(result.data);

        _itemsLoading = false;
        // 通知等待中的回调
        _itemsCallbacks.forEach(function(cb) { cb(_itemsCache); });
        _itemsCallbacks = [];
        return _itemsCache;
      } else {
        throw new Error(result.msg || '加载失败');
      }
    })
    .catch(function(err) {
      _itemsLoading = false;
      Mode.Debug.error('CloudData', '❌ 物品数据加载失败: ' + err.message);
      // 如果有本地缓存，尝试从localStorage恢复（降级）
      var local = loadItemsFromLocal();
      if (local) {
        window.item_info_all = local;
        buildInitialData(local);
        _itemsCallbacks.forEach(function(cb) { cb(local); });
        _itemsCallbacks = [];
        return local;
      }
      _itemsCallbacks.forEach(function(cb) { cb([]); });
      _itemsCallbacks = [];
      return [];
    });
  }

  /* ── 从localStorage加载缓存的物品数据（降级方案） ── */
  function loadItemsFromLocal() {
    try {
      var raw = localStorage.getItem('bqb_items_cache');
      if (raw) {
        var data = JSON.parse(raw);
        Mode.Debug.warn('CloudData', '⚠️ 使用本地缓存物品数据: ' + (data.length || 0) + ' 条');
        return data;
      }
    } catch(e) {}
    return null;
  }

  /* ── 缓存物品数据到localStorage（供断网时降级） ── */
  function cacheItemsToLocal(data) {
    try {
      localStorage.setItem('bqb_items_cache', JSON.stringify(data));
    } catch(e) {
      // localStorage可能已满
    }
  }

  /* ── 获取物品数据接口（兼容旧代码） ── */
  function getItems() {
    if (_itemsCache) return _itemsCache;
    // 先尝试本地缓存
    var local = loadItemsFromLocal();
    if (local) {
      _itemsCache = local;
      window.item_info_all = local;
      return local;
    }
    return [];
  }

  /* ── 按ID查找物品 ── */
  function getItemById(id) {
    var items = getItems();
    return items.find(function(item) { return item.id === id; }) || null;
  }

  /* ── 按类型筛选物品 ── */
  function getItemsByType(type) {
    var items = getItems();
    return items.filter(function(item) { return item.primaryClass === type; });
  }

  /* ── 搜索物品 ── */
  function searchItems(keyword) {
    var items = getItems();
    var kw = keyword.toLowerCase();
    return items.filter(function(item) {
      return item.objectName.toLowerCase().indexOf(kw) !== -1 ||
             (item.secondClass && item.secondClass.toLowerCase().indexOf(kw) !== -1);
    });
  }


  /* ══════════════════════════════════════════════════════════════
     ② 系统日志（原 rizhi.js localStorage）
     ══════════════════════════════════════════════════════════════ */

  /* ── 从云端获取日志 ── */
  function fetchLogsFromCloud() {
    var url = getApiBase() + '/logs.php';
    return fetch(url)
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0) return result.data || [];
        return [];
      })
      .catch(function() { return []; });
  }

  /* ── 添加日志到云端 ── */
  function addLogToCloud(tag, text, time) {
    var url = getApiBase() + '/logs.php';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag: tag || 'info',
        text: text || '',
        time: time || '',
      }),
    })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      return result.ret === 0;
    })
    .catch(function() { return false; });
  }

  /* ── 清空云端日志 ── */
  function clearLogsFromCloud(adminPass) {
    var url = getApiBase() + '/logs.php?admin_key=' + encodeURIComponent(adminPass);
    return fetch(url, { method: 'DELETE' })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        return result.ret === 0;
      })
      .catch(function() { return false; });
  }


  /* ══════════════════════════════════════════════════════════════
     ③ 兼容层：构建 BQB_INITIAL_DATA（原 bqb_data.js 提供）
     ══════════════════════════════════════════════════════════════ */

  var _initialDataBuilt = false;

  function buildInitialData(items) {
    if (_initialDataBuilt) return;
    _initialDataBuilt = true;

    // 1. 整理元数据：按 primaryClass 分组
    var metaData = {};
    if (items && items.length > 0) {
      items.forEach(function(item) {
        var cat = item.primaryClass || item.type || 'other';
        if (!metaData[cat]) metaData[cat] = [];
        metaData[cat].push(item);
      });
    }

    // 2. 暴露到全局（兼容旧代码）
    window.BQB_INITIAL_DATA = {
      meta: metaData,
      raw: { item_info_all: items },
      ts: Date.now(),
    };

    Mode.Debug.log('CloudData', '✅ 兼容层 BQB_INITIAL_DATA 已构建');
  }


  /* ══════════════════════════════════════════════════════════════
     ④ 初始化
     ══════════════════════════════════════════════════════════════ */

  function init() {
    Mode.Debug.log('CloudData', '═══════════ 云端数据层 ═══════════');
    Mode.Debug.log('CloudData', '☁️ 物品数据: 从本地SQLite(game_items)读取');
    Mode.Debug.log('CloudData', '☁️ 系统日志: 从本地SQLite(system_logs)读写');
    Mode.Debug.log('CloudData', '═══════════════════════════════════');

    // 预加载物品数据（静默）
    loadItemsFromCloud().then(function(items) {
      // 缓存到localStorage作为离线降级
      if (items && items.length > 0) {
        cacheItemsToLocal(items);
      }
      Mode.Debug.log('CloudData', '✅ 物品数据预加载完成');
    });
  }

  /* ══════════════════════════════════════════════════════════════
     暴露到 Mode 命名空间
     ══════════════════════════════════════════════════════════════ */

  Mode.CloudData = {
    // ── 物品数据 ──
    loadItems: loadItemsFromCloud,
    getItems: getItems,
    getItemById: getItemById,
    getItemsByType: getItemsByType,
    searchItems: searchItems,

    // ── 系统日志 ──
    fetchLogs: fetchLogsFromCloud,
    addLog: addLogToCloud,
    clearLogs: clearLogsFromCloud,

    // ── 初始化 ──
    init: init,
  };

  // 自动初始化
  Mode.ready(function() {
    Mode.CloudData.init();
  });

})();