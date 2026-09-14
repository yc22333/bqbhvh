/* ============================================================
   mode.js — 比奇堡报价单 · 全局核心模块 [FINAL READ-ONLY VERSION]
   核心法则：
   • 所有数值默认显示为整数，小数部分直接截断，永不四舍五入
   • 仅在被显式指定时才保留小数位
   • 囊括加减乘除及所有复杂运算逻辑
   • 本文件最终化，后续不再修改，只读不写
   ============================================================ */

const Mode = (() => {
  "use strict";

  /* ==================== 全局常量 & 配置 ==================== */
  const CONFIG = {
    APP_NAME: "比奇堡报价单",
    VERSION:  "5.0.2",
    LOCALE:   "zh-CN",

    COLORS: {
      SQUIDWARD_BLUE:  "#5BC0DE",
      SPONGEBOB_YELLOW:"#F5D742",
      PATRICK_PINK:    "#FF6B9D",
    },

    DEBUG: true,

    // 存储前缀
    STORAGE_PREFIX: "bqb_",

    // 默认小数位数（仅在被显式请求时使用）
    DEFAULT_DECIMALS: 2,

    // 默认货币符号
    DEFAULT_CURRENCY: "¥",
  };

  /* ==================== 全局状态 ==================== */
  let state = {
    items:       [],
    discount:    0,
    currency:    CONFIG.DEFAULT_CURRENCY,
    grandTotal:  0,
    itemCount:   0,
  };

  /* ==================== 调试模块 ==================== */
  const Debug = {
    _enabled: CONFIG.DEBUG,

    enable()  { this._enabled = true;  return this; },
    disable() { this._enabled = false; return this; },
    isEnabled(){ return this._enabled; },

    _timestamp() {
      const now = new Date();
      return now.toLocaleTimeString("zh-CN", { hour12: false })
        + "." + String(now.getMilliseconds()).padStart(3, "0");
    },

    log(tag, ...args) {
      if (!this._enabled) return;
      console.log(
        `%c[${CONFIG.APP_NAME}]%c [${this._timestamp()}] %c${tag}`,
        "color:#FF6B9D;font-weight:bold;",
        "color:#6B7A8D;",
        "color:#5BC0DE;font-weight:bold;",
        ...args
      );
    },

    warn(tag, ...args) {
      if (!this._enabled) return;
      console.warn(
        `%c[${CONFIG.APP_NAME}]%c [${this._timestamp()}] %c${tag}`,
        "color:#FF6B9D;font-weight:bold;",
        "color:#6B7A8D;",
        "color:#F5D742;font-weight:bold;",
        ...args
      );
    },

    error(tag, ...args) {
      console.error(
        `%c[${CONFIG.APP_NAME}]%c [${this._timestamp()}] %c${tag}`,
        "color:#FF6B9D;font-weight:bold;",
        "color:#6B7A8D;",
        "color:#FF6B9D;font-weight:bold;",
        ...args
      );
    },

    table(data, tag) {
      if (!this._enabled || !data) return;
      console.group(`%c[${CONFIG.APP_NAME}] ${tag || "Table"}`,
        "color:#FF6B9D;font-weight:bold;");
      console.table(data);
      console.groupEnd();
    },
  };

  /* ==================== 核心数学：截断体系（永不四舍五入） ==================== */

  function int(value) {
    if (value == null || isNaN(value)) return 0;
    const sign = Number(value) >= 0 ? 1 : -1;
    return sign * Math.floor(Math.abs(Number(value)));
  }

  function decimal(value, places) {
    if (value == null || isNaN(value)) return 0;
    const p = (places != null) ? places : CONFIG.DEFAULT_DECIMALS;
    const factor = Math.pow(10, p);
    const sign = Number(value) >= 0 ? 1 : -1;
    return sign * Math.floor(Math.abs(Number(value)) * factor) / factor;
  }

  function add(a, b)        { return int(parseNumber(a) + parseNumber(b)); }
  function subtract(a, b)   { return int(parseNumber(a) - parseNumber(b)); }
  function multiply(a, b)   { return int(parseNumber(a) * parseNumber(b)); }
  function divide(a, b)     { return b !== 0 && b != null ? int(parseNumber(a) / parseNumber(b)) : 0; }
  function power(base, exp) { return int(Math.pow(parseNumber(base), parseNumber(exp))); }
  function sqrt(value)      { return int(Math.sqrt(parseNumber(value))); }
  function abs(value)       { return int(Math.abs(parseNumber(value))); }
  function mod(a, b)        { return b !== 0 && b != null ? int(parseNumber(a) % parseNumber(b)) : 0; }

  function gcd(a, b) {
    let x = abs(parseNumber(a));
    let y = abs(parseNumber(b));
    while (y) { const t = y; y = mod(x, y); x = t; }
    return x;
  }

  function lcm(a, b) {
    const x = abs(parseNumber(a));
    const y = abs(parseNumber(b));
    if (x === 0 || y === 0) return 0;
    return int(divide(multiply(x, y), gcd(x, y)));
  }

  function factorial(n) {
    let v = int(parseNumber(n));
    if (v < 0) return 0;
    let result = 1;
    for (let i = 2; i <= v; i++) { result = multiply(result, i); }
    return result;
  }

  /* ==================== 数组与统计 ==================== */

  function sum(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return int(arr.reduce((acc, v) => acc + parseNumber(v), 0));
  }

  function product(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return int(arr.reduce((acc, v) => multiply(acc, parseNumber(v)), 1));
  }

  function average(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return divide(sum(arr), arr.length);
  }

  function median(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const sorted = arr.map(parseNumber).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? int(sorted[mid]) : int(average([sorted[mid - 1], sorted[mid]]));
  }

  function min(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return int(Math.min(...arr.map(parseNumber)));
  }

  function max(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return int(Math.max(...arr.map(parseNumber)));
  }

  function range(start, end, step) {
    const s = int(parseNumber(start));
    const e = int(parseNumber(end));
    const st = (step != null) ? int(parseNumber(step)) : 1;
    if (st === 0) return [];
    const result = [];
    if (st > 0) { for (let i = s; i <= e; i = add(i, st)) result.push(i); }
    else        { for (let i = s; i >= e; i = add(i, st)) result.push(i); }
    return result;
  }

  function clamp(value, minVal, maxVal) {
    const v = int(parseNumber(value));
    const lo = int(parseNumber(minVal));
    const hi = int(parseNumber(maxVal));
    return Math.max(lo, Math.min(hi, v));
  }

  function percent(value, pct) {
    return int(parseNumber(value) * parseNumber(pct) / 100);
  }

  /* ==================== 格式化 ==================== */

  function formatInt(value) {
    if (value == null || isNaN(value)) return "—";
    return int(value).toLocaleString(CONFIG.LOCALE);
  }

  function formatDecimal(value, places) {
    if (value == null || isNaN(value)) return "—";
    const p = (places != null) ? places : CONFIG.DEFAULT_DECIMALS;
    return decimal(Number(value), p).toLocaleString(CONFIG.LOCALE, {
      minimumFractionDigits: p,
      maximumFractionDigits: p,
    });
  }

  function formatCurrency(value, symbol) {
    const sym = symbol || state.currency || CONFIG.DEFAULT_CURRENCY;
    return sym + formatInt(value);
  }

  function parseNumber(raw) {
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string") return 0;
    const cleaned = raw.replace(/[¥$￥,\s]/g, "").replace(/，/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /* ==================== 报价计算引擎 ==================== */

  function calcItemTotal(unitPrice, quantity) {
    return int(parseNumber(unitPrice) * parseNumber(quantity));
  }

  function calcSubtotal(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return sum(items.map(item => calcItemTotal(item.unitPrice, item.quantity)));
  }

  function calcDiscountAmount(subtotal, discountRate) {
    return percent(subtotal, parseNumber(discountRate));
  }

  function calcGrandTotal(subtotal, discountAmt) {
    const disc = (discountAmt != null) ? parseNumber(discountAmt) : state.discount;
    return subtract(subtotal, disc);
  }

  function calcFullQuote(items, options) {
    const opts = options || {};
    const discountRate = opts.discountRate ?? 0;
    const itemList = items || state.items;

    const subtotal   = calcSubtotal(itemList);
    const discountAmt= calcDiscountAmount(subtotal, discountRate);
    const grandTotal = calcGrandTotal(subtotal, discountAmt);

    const result = {
      subtotal:    subtotal,
      discount:    discountAmt,
      grandTotal:  grandTotal,
      itemCount:   itemList.length,
    };

    Debug.log("Calc", "完整报价计算完成", result);
    return result;
  }

  /* ==================== 状态管理 ==================== */

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function setState(patch) {
    if (!patch || typeof patch !== "object") return;
    Object.assign(state, patch);
    Debug.log("State", "状态更新", { ...state });
  }

  function resetState() {
    state = {
      items:       [],
      discount:    0,
      currency:    CONFIG.DEFAULT_CURRENCY,
      grandTotal:  0,
      itemCount:   0,
    };
    Debug.log("State", "状态已重置");
  }

  function addItem(item) {
    if (!item || !item.name) {
      Debug.warn("State", "添加条目失败：缺少名称", item);
      return null;
    }
    const newItem = {
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name:      item.name,
      unitPrice: int(parseNumber(item.unitPrice)),
      quantity:  int(parseNumber(item.quantity)) || 1,
      note:      item.note || "",
    };
    state.items.push(newItem);
    state.itemCount = state.items.length;
    Debug.log("State", `条目已添加: ${item.name}`);
    return newItem.id;
  }

  function removeItem(id) {
    const len = state.items.length;
    state.items = state.items.filter(item => item.id !== id);
    state.itemCount = state.items.length;
    if (state.items.length < len) {
      Debug.log("State", `条目已删除: ${id}`);
      return true;
    }
    return false;
  }

  function getItem(id) {
    return state.items.find(item => item.id === id) || null;
  }

  function updateItem(id, patch) {
    const item = state.items.find(item => item.id === id);
    if (!item) return false;
    if (patch.unitPrice != null) patch.unitPrice = int(parseNumber(patch.unitPrice));
    if (patch.quantity  != null) patch.quantity  = int(parseNumber(patch.quantity));
    Object.assign(item, patch);
    Debug.log("State", `条目已更新: ${id}`);
    return true;
  }

  function clearItems() {
    state.items = [];
    state.itemCount = 0;
    Debug.log("State", "所有条目已清除");
  }

  /* ==================== DOM 快捷操作 ==================== */

  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return (context || document).querySelectorAll(selector);
  }

  function ready(fn) {
    if (document.readyState !== "loading") { fn(); }
    else { document.addEventListener("DOMContentLoaded", fn); }
  }

  function html(el, content) {
    const e = (typeof el === "string") ? $(el) : el;
    if (!e) return "";
    if (content !== undefined) { e.innerHTML = content; return e; }
    return e.innerHTML;
  }

  function text(el, content) {
    const e = (typeof el === "string") ? $(el) : el;
    if (!e) return "";
    if (content !== undefined) { e.textContent = content; return e; }
    return e.textContent;
  }

  function val(el, content) {
    const e = (typeof el === "string") ? $(el) : el;
    if (!e) return "";
    if (content !== undefined) { e.value = content; return e; }
    return e.value;
  }

  function attr(el, name, value) {
    const e = (typeof el === "string") ? $(el) : el;
    if (!e) return null;
    if (value !== undefined) { e.setAttribute(name, value); return e; }
    return e.getAttribute(name);
  }

  function addClass(el, className) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.classList.add(className);
    return e;
  }

  function removeClass(el, className) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.classList.remove(className);
    return e;
  }

  function toggleClass(el, className) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.classList.toggle(className);
    return e;
  }

  function hasClass(el, className) {
    const e = (typeof el === "string") ? $(el) : el;
    return e ? e.classList.contains(className) : false;
  }

  function show(el) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.style.display = "";
    return e;
  }

  function hide(el) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.style.display = "none";
    return e;
  }

  function create(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (key === "class") { el.className = attrs[key]; }
        else if (key === "style" && typeof attrs[key] === "object") { Object.assign(el.style, attrs[key]); }
        else { el.setAttribute(key, attrs[key]); }
      }
    }
    if (children) {
      if (typeof children === "string") { el.textContent = children; }
      else if (Array.isArray(children)) { children.forEach(child => { if (child) el.appendChild(child); }); }
      else if (children instanceof Node) { el.appendChild(children); }
    }
    return el;
  }

  function append(parent, child) {
    const p = (typeof parent === "string") ? $(parent) : parent;
    if (!p) return null;
    if (typeof child === "string") { p.insertAdjacentHTML("beforeend", child); return p; }
    if (child instanceof Node) { p.appendChild(child); }
    return child;
  }

  function remove(el) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e && e.parentNode) e.parentNode.removeChild(e);
  }

  function empty(el) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.innerHTML = "";
    return e;
  }

  /* ==================== 事件工具 ==================== */

  function delegate(parent, eventType, childSelector, handler) {
    const p = (typeof parent === "string") ? $(parent) : parent;
    if (!p) return;
    p.addEventListener(eventType, (e) => {
      const target = e.target.closest(childSelector);
      if (target && p.contains(target)) {
        handler.call(target, e, target);
      }
    });
  }

  function on(el, eventType, handler) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.addEventListener(eventType, handler);
    return e;
  }

  function off(el, eventType, handler) {
    const e = (typeof el === "string") ? $(el) : el;
    if (e) e.removeEventListener(eventType, handler);
    return e;
  }

  function debounce(fn, delay) {
    const d = delay || 300;
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), d);
    };
  }

  function throttle(fn, interval) {
    const iv = interval || 300;
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= iv) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  /* ==================== 本地存储 ==================== */

  function _storageKey(key) {
    return CONFIG.STORAGE_PREFIX + key;
  }

  function saveToStorage(key, data) {
    try {
      localStorage.setItem(_storageKey(key), JSON.stringify(data));
      Debug.log("Storage", `已保存: ${key}`);
      return true;
    } catch (e) {
      Debug.error("Storage", "保存失败", e);
      return false;
    }
  }

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(_storageKey(key));
      return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
    } catch (e) {
      Debug.error("Storage", "读取失败", e);
      return fallback !== undefined ? fallback : null;
    }
  }

  function clearStorage(key) {
    localStorage.removeItem(_storageKey(key));
    Debug.log("Storage", `已清除: ${key}`);
  }

  function clearAllStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(CONFIG.STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    Debug.log("Storage", `已清除全部 ${keys.length} 条数据`);
    return keys.length;
  }

  /* ==================== Toast 提示系统 ==================== */

  // 注入 Toast 样式（只执行一次）
  (function _injectToastStyle() {
    var styleId = 'bqb-toast-style';
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '.bqb-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-120px);' +
      'background:rgba(0,0,0,0.88);color:#fff;padding:14px 28px;border-radius:10px;' +
      'font-size:15px;z-index:999999;font-family:"微软雅黑","PingFang SC",sans-serif;' +
      'box-shadow:0 6px 30px rgba(0,0,0,0.4);transition:transform 0.35s cubic-bezier(.34,1.56,.64,1),opacity 0.35s ease;' +
      'opacity:0;pointer-events:none;max-width:88vw;text-align:center;line-height:1.6;' +
      'border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(4px);}' +
      '.bqb-toast.show{transform:translateX(-50%) translateY(0);opacity:1;}' +
      '.bqb-toast.warn{border-color:#F5D742;color:#F5D742;}' +
      '.bqb-toast.error{border-color:#FF6B6B;color:#FF6B6B;}' +
      '.bqb-toast.info{border-color:#5BC0DE;color:#5BC0DE;}';
    document.head.appendChild(style);
  })();

  var _toastTimer = null;

  /**
   * 显示一个非阻塞的 Toast 提示（自动消失）
   * @param {string} msg  - 提示内容
   * @param {string} type - 类型: 'error' | 'warn' | 'info' | ''（默认白色）
   */
  function showToast(msg, type) {
    var existing = document.querySelector('.bqb-toast');
    if (existing) {
      existing.remove();
      if (_toastTimer) clearTimeout(_toastTimer);
    }
    var toast = document.createElement('div');
    toast.className = 'bqb-toast' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : type === 'info' ? ' info' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    _toastTimer = setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 350);
    }, 3000);
  }

  /** 网络错误提示（每会话只弹一次，用 localStorage 标记） */
  function showNetworkError(msg) {
    try {
      if (localStorage.getItem('_bqb_net_err_shown')) return;
    } catch (e) { /* 无痕模式可能抛异常，忽略 */ }
    showToast(msg || '❌ 网络错误，请检查网络连接', 'error');
    try { localStorage.setItem('_bqb_net_err_shown', '1'); } catch (e) {}
  }

  /** 检测是否在本地环境下运行（file:// 或 localhost） */
  function isLocalFile() {
    return window.location.protocol === 'file:' ||
           window.location.hostname === '' ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  }

  /* ==================== 暴露公共 API ==================== */
  return {
    CONFIG,
    Debug,

    // 核心数学（截断体系）
    int,
    decimal,
    add,
    subtract,
    multiply,
    divide,
    power,
    sqrt,
    abs,
    mod,
    gcd,
    lcm,
    factorial,

    // 数组与统计
    sum,
    product,
    average,
    median,
    min,
    max,
    range,
    clamp,
    percent,

    // 格式化
    formatInt,
    formatDecimal,
    formatCurrency,
    parseNumber,

    // 报价计算引擎
    calcItemTotal,
    calcSubtotal,
    calcDiscountAmount,
    calcGrandTotal,
    calcFullQuote,

    // 状态管理
    getState,
    setState,
    resetState,
    addItem,
    removeItem,
    getItem,
    updateItem,
    clearItems,

    // DOM 操作
    $$,
    $,
    ready,
    html,
    text,
    val,
    attr,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    show,
    hide,
    create,
    append,
    remove,
    empty,

    // 事件工具
    delegate,
    on,
    off,
    debounce,
    throttle,

    // 存储
    saveToStorage,
    loadFromStorage,
    clearStorage,
    clearAllStorage,

    // Toast 提示系统
    showToast,
    showNetworkError,
    isLocalFile,
  };
})();

/* 兼容：确保 Mode 能从 window 访问 */
if (typeof window !== 'undefined') {
  window.Mode = Mode;
}

// 启动日志
Mode.Debug.log("Init", `v${Mode.CONFIG.VERSION} 核心模块已就绪`);


/* ============================================================
   Guize — 首页框架规则系统
   功能: 框架布局规则执行器 + 规则常量定义
   依赖: Mode 命名空间 (Mode.Debug, Mode.ready)
   [CREATED: 2026-06-09] [MERGED INTO GLOBAL CORE]
   ============================================================ */

const Guize = (() => {
  'use strict';

  /* ==========================================================
     规则常量 — 与 base.css 的 --sy-* 变量保持同步
     ========================================================== */

  const RULES = {
    /* 三色体系 */
    COLOR: {
      PRIMARY:   '章鱼哥蓝',
      ACCENT:    '派大星粉',
      SECONDARY: '海绵宝宝黄',
    },

    /* 大框架规则 */
    FRAME: {
      MIN_WIDTH:   320,    // 规则⑤：最小宽度 px
      PADDING_Y:   20,     // 规则④：上下安全间距 px
      PADDING_X:   24,     // 规则④：左右安全间距 px
      GAP:         20,     // 框架间距 px
    },

    /* 小框架规则 */
    SUBFRAME: {
      MIN_WIDTH:   240,
      PADDING:     16,
    },
  };


  /* ==========================================================
     初始化
     ========================================================== */

  let initialized = false;
  let resizeTimer = null;

  function init() {
    if (initialized) return;
    initialized = true;

    bindResize();
    validateFrames();
    initClickableFrames();

    Mode.Debug.log('Guize', '首页规则系统已就绪');
  }


  /* ==========================================================
     规则② 监听窗口缩放 → 触发框架自适应
     ========================================================== */

  function bindResize() {
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        onResize();
      }, 150);
    });
  }

  function onResize() {
    /* 规则②：横向缩放时，框架左右边距由 CSS 自动处理 */
    Mode.Debug.log('Guize', '窗口缩放 · 框架自适应');
  }


  /* ==========================================================
     规则④ 验证所有框架是否满足内容安全间距
     ========================================================== */

  function validateFrames() {
    var frames = document.querySelectorAll('.shouye-frame, .shouye-subframe');
    if (!frames || frames.length === 0) return;

    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      var style = window.getComputedStyle(frame);
      var padTop = parseFloat(style.paddingTop);
      var padLeft = parseFloat(style.paddingLeft);

      if (padTop < RULES.FRAME.PADDING_Y - 4 ||
          padLeft < RULES.FRAME.PADDING_X - 4) {
        Mode.Debug.warn('Guize', '框架间距不足:', frame);
      }
    }
  }


  /* ==========================================================
     规则① 获取框架信息（调试/维护用）
     ========================================================== */

  function getFrameInfo(selector) {
    var el = document.querySelector(selector);
    if (!el) return null;

    return {
      element:  el,
      width:    el.offsetWidth,
      height:   el.offsetHeight,
      padding: {
        top:    parseFloat(window.getComputedStyle(el).paddingTop),
        right:  parseFloat(window.getComputedStyle(el).paddingRight),
        bottom: parseFloat(window.getComputedStyle(el).paddingBottom),
        left:   parseFloat(window.getComputedStyle(el).paddingLeft),
      },
    };
  }


  /* ==========================================================
     自动初始化
     ========================================================== */

  Mode.ready(init);


  /* ==========================================================
     交互扩展：可点击框架（区域按钮）
     ========================================================== */

  function initClickableFrames() {
    var els = document.querySelectorAll(
      '.shouye-frame--clickable, .shouye-subframe--clickable'
    );
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('click', function () {
        fireFrameClick(this);
      });
    }
    if (els.length > 0) {
      Mode.Debug.log('Guize', '可点击框架:' + els.length);
    }
  }

  var _frameClickHandler = null;

  function fireFrameClick(el) {
    if (typeof _frameClickHandler === 'function') {
      _frameClickHandler(el);
    }
  }

  function onFrameClick(callback) {
    _frameClickHandler = callback;
  }


  /* ==========================================================
     公开 API
     ========================================================== */

  return {
    init,
    RULES,
    getFrameInfo,
    validateFrames,
    initClickableFrames,
    onFrameClick,
  };
})();