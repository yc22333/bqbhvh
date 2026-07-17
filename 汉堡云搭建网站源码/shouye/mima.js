/* ============================================================
   mima.js — 今日密码+地图逻辑
   ============================================================ */

const Mima = (() => {
  'use strict';

  /* ========== 初始化 ========== */
  function init() {
    startCrashBeijingTime();
    loadMapPasswords();
  }

  /* ========== 撞车北京时间（毫秒级，优化版） ========== */
  var _crashRafId = null;

  function startCrashBeijingTime() {
    var digitsEl = document.getElementById("crashTimeDigits");
    var millisEl = document.getElementById("crashTimeMillis");
    if (!digitsEl || !millisEl) return;

    var lastDigits = '';
    var lastMillis = '';

    function tick() {
      var now = new Date();
      var h = String(now.getHours()).padStart(2, '0');
      var m = String(now.getMinutes()).padStart(2, '0');
      var s = String(now.getSeconds()).padStart(2, '0');
      var ms = String(now.getMilliseconds()).padStart(3, '0');

      var newDigits = h + ':' + m + ':' + s;
      var newMillis = '.' + ms;

      // 只在值变化时更新DOM，避免不必要的重排/重绘
      if (newDigits !== lastDigits) {
        digitsEl.textContent = newDigits;
        lastDigits = newDigits;
      }
      if (newMillis !== lastMillis) {
        millisEl.textContent = newMillis;
        lastMillis = newMillis;
      }

      _crashRafId = requestAnimationFrame(tick);
    }

    _crashRafId = requestAnimationFrame(tick);
  }

  /* ========== 加载各地图今日密码 ========== */
  function loadMapPasswords() {
    for (let mapId = 1; mapId <= 5; mapId++) {
      fetchMapPassword(mapId);
    }
  }

  function fetchMapPassword(mapId) {
    const passwordEl = document.getElementById('map-password-' + mapId);
    if (!passwordEl) return;

    if (typeof Mode !== 'undefined' && Mode.SjzApi && Mode.SjzApi.mapPwd) {
      if (!window._mapPwdData) {
        window._mapPwdData = Mode.SjzApi.mapPwd().then(function(data) {
          console.log('🔥 map_pwd 返回数据:', JSON.stringify(data, null, 2));
          return data;
        }).catch(function(err) {
          console.error('获取每日密码失败', err);
          window._mapPwdData = null;
          return null;
        });
      }
      window._mapPwdData.then(function(data) {
        if (data && typeof data === 'object') {
          var mapKeys = ['a', 'b', 'c', 'd', 'e'];
          var key = mapKeys[mapId - 1];
          if (data[key] && Array.isArray(data[key])) {
            passwordEl.textContent = data[key][0] || '--';
          } else if (data.passwords && data.passwords.length >= mapId) {
            var pwdItem = data.passwords[mapId - 1];
            var pwd = pwdItem.password || pwdItem.pwd || pwdItem.code || '';
            passwordEl.textContent = pwd || '--';
          } else if (data.data && data.data.passwords && data.data.passwords.length >= mapId) {
            var pwdItem2 = data.data.passwords[mapId - 1];
            var pwd2 = pwdItem2.password || pwdItem2.pwd || pwdItem2.code || '';
            passwordEl.textContent = pwd2 || '--';
          } else if (data['map_' + mapId]) {
            passwordEl.textContent = data['map_' + mapId] || '--';
          } else {
            passwordEl.textContent = '--';
          }
        } else {
          passwordEl.textContent = '--';
        }
        passwordEl.setAttribute('style', 'font-family: "楷体", "KaiTi", "STKaiti", serif !important;' + passwordEl.getAttribute('style'));
      });
    } else {
      passwordEl.textContent = '--';
    }
  }

  /* ========== 自动初始化 ========== */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ========== 外部：强制刷新（清空 promise 缓存后重新加载）========== */
  function refresh() {
    window._mapPwdData = null;
    loadMapPasswords();
  }

  /* ========== 公开 API ========== */
  return {
    init,
    refresh,
  };
})();