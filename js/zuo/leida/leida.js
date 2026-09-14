/* ============================================================
   leida.js — 雷达页面逻辑
   功能: 展示两个服务器网页（iframe 嵌入 + Service Worker 代理）
   依赖: Mode (mode.js), sw.js (Service Worker)
   [CREATED: 2026-09-15] [UPDATED: 2026-09-15]
   ============================================================ */

const Leida = (() => {
  'use strict';

  /* ── 服务器配置（在这里修改地址） ── */
  const SERVERS = [
    {
      id: 'svr1',
      name: '一号服务器',
      url: 'http://118.195.177.91:2083/'
    },
    {
      id: 'svr2',
      name: '二号服务器',
      url: 'http://27.102.134.119:2083/'
    }
  ];

  let _currentServerId = 'svr1';
  let _initialized = false;
  let _swReady = false;   // Service Worker 是否激活

  /* ── 获取代理 URL（通过 SW 将 HTTP → HTTPS） ── */
  function getProxyUrl(serverId) {
    // 动态获取网站根路径（兼容 GitHub Pages 子目录 /bqbhvh/）
    var path = window.location.pathname;
    // 如果路径包含文件名，截取到目录
    if (!path.endsWith('/') && path.lastIndexOf('/') > 0) {
      path = path.substring(0, path.lastIndexOf('/') + 1);
    }
    // 例如: /bqbhvh/proxy/svr1/
    return window.location.origin + path + 'proxy/' + serverId + '/';
  }

  /* ── 决定 iframe 使用的 URL ── */
  function getIframeUrl(server) {
    if (_swReady) {
      return getProxyUrl(server.id);
    }
    // SW 不可用时用直接 HTTP 地址（本地开发环境没有 HTTPS 限制）
    return server.url;
  }

  /* ── 初始化 Service Worker ── */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      Mode.Debug.log('Leida', 'Service Worker 不支持，使用直接 HTTP');
      return;
    }

    // 检查是否已被 SW 控制（说明 SW 已激活）
    if (navigator.serviceWorker.controller) {
      // 检查 controller 的 URL 是否包含 sw.js（确认是我们的 SW）
      var swUrl = navigator.serviceWorker.controller.scriptURL;
      if (swUrl.indexOf('sw.js') !== -1) {
        _swReady = true;
        Mode.Debug.log('Leida', 'Service Worker 已激活');
        return;
      }
    }

    // 注册 SW
    var swPath = getSwPath();
    if (!swPath) return;

    navigator.serviceWorker.register(swPath)
      .then(function (reg) {
        Mode.Debug.log('Leida', 'Service Worker 已注册');

        // 监听激活状态
        if (reg.active) {
          _swReady = true;
          Mode.Debug.log('Leida', 'Service Worker 已激活');
          // 重新加载 iframe 使用代理 URL
          reloadIframeWithProxy();
        }

        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'activated') {
              _swReady = true;
              Mode.Debug.log('Leida', 'Service Worker 激活完成');
              reloadIframeWithProxy();
            }
          });
        });
      })
      .catch(function (err) {
        Mode.Debug.warn('Leida', 'Service Worker 注册失败: ' + err.message);
        _swReady = false;
      });
  }

  /* ── 获取 SW 文件路径 ── */
  function getSwPath() {
    var path = window.location.pathname;
    if (!path.endsWith('/') && path.lastIndexOf('/') > 0) {
      path = path.substring(0, path.lastIndexOf('/') + 1);
    }
    return window.location.origin + path + 'sw.js';
  }

  /* ── SW 激活后重新加载 iframe ── */
  function reloadIframeWithProxy() {
    var iframe = document.getElementById('leidaIframe');
    if (!iframe) return;
    var currentSrc = iframe.getAttribute('src');
    if (!currentSrc || currentSrc === 'about:blank') return;
    // 如果当前用的是直接 HTTP 地址，切换到代理地址
    for (var i = 0; i < SERVERS.length; i++) {
      if (currentSrc === SERVERS[i].url) {
        var target = getServer(_currentServerId);
        if (target) {
          iframe.src = getProxyUrl(target.id);
          updateInfoBar(target);
        }
        break;
      }
    }
  }

  /* ── 渲染页面 ── */
  function render() {
    var container = document.getElementById('leidaContent');
    if (!container) return;

    if (!_initialized) {
      buildUI(container);
      _initialized = true;
      // 在首次渲染时注册 SW
      initServiceWorker();
    }

    ensureIframe();
  }

  /* ── 构建 UI（只执行一次） ── */
  function buildUI(container) {
    var firstSvr = SERVERS[0];
    var firstUrl = getIframeUrl(firstSvr);

    // 选项卡
    var tabsHtml = '';
    SERVERS.forEach(function (svr, idx) {
      var active = idx === 0 ? ' active' : '';
      tabsHtml +=
        '<button class="leida-tab' + active + '" data-server="' + svr.id + '">' +
          svr.name +
        '</button>';
    });

    var html =
      // 选项卡
      '<div class="leida-toolbar">' +
        '<div class="leida-tabs">' + tabsHtml + '</div>' +
      '</div>' +

      // 当前服务器信息 + 直接打开按钮
      '<div class="leida-info-bar" id="leidaInfoBar">' +
        '<span class="leida-info-url" id="leidaInfoUrl">' + firstSvr.url + '</span>' +
        '<a class="leida-open-btn" id="leidaOpenBtn" href="' + firstSvr.url + '" target="_blank" rel="noopener noreferrer">' +
          '在新标签页中打开 ↗' +
        '</a>' +
      '</div>' +

      // iframe 区域
      '<div class="leida-iframe-wrapper">' +
        '<iframe class="leida-iframe" id="leidaIframe" src="' + firstUrl + '"' +
          ' sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="服务器页面">' +
        '</iframe>' +
        '<div class="leida-iframe-fallback" id="leidaFallback">' +
          '<div class="leida-fallback-icon">🔒</div>' +
          '<div class="leida-fallback-text">' +
            'GitHub Pages 使用 HTTPS，浏览器已拦截 HTTP 内容。' +
          '</div>' +
          '<a class="leida-fallback-btn" id="leidaFallbackBtn" href="' + firstSvr.url + '" target="_blank" rel="noopener noreferrer">' +
            '点击在新标签页中打开' +
          '</a>' +
        '</div>' +
      '</div>' +

      // 页脚
      '<div class="leida-footer">点击选项卡切换服务器 · 若页面空白请稍后刷新</div>';

    container.innerHTML = html;

    bindTabEvents();

    // 检测 iframe 是否被拦截
    detectIframeBlocked();
  }

  /* ── 检测 iframe 是否加载失败 ── */
  function detectIframeBlocked() {
    var iframe = document.getElementById('leidaIframe');
    var fallback = document.getElementById('leidaFallback');
    if (!iframe || !fallback) return;

    var loaded = false;

    iframe.addEventListener('load', function () {
      loaded = true;
      fallback.classList.remove('visible');
    });

    // 4秒后如果还没加载成功，显示 fallback
    setTimeout(function () {
      if (!loaded) {
        fallback.classList.add('visible');
      }
    }, 4000);
  }

  /* ── 确保 iframe 正确显示 ── */
  function ensureIframe() {
    var iframe = document.getElementById('leidaIframe');
    if (!iframe) return;

    var src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') {
      var target = getServer(_currentServerId);
      if (target) {
        iframe.src = getIframeUrl(target);
        updateInfoBar(target);
      }
    }
  }

  /* ── 更新信息栏 ── */
  function updateInfoBar(svr) {
    var urlEl = document.getElementById('leidaInfoUrl');
    var btnEl = document.getElementById('leidaOpenBtn');
    var fallbackBtnEl = document.getElementById('leidaFallbackBtn');
    if (urlEl) urlEl.textContent = svr.url;
    if (btnEl) btnEl.href = svr.url;
    if (fallbackBtnEl) fallbackBtnEl.href = svr.url;
  }

  /* ── 绑定切换按钮事件 ── */
  function bindTabEvents() {
    var tabs = document.querySelectorAll('.leida-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var serverId = tab.getAttribute('data-server');
        switchServer(serverId);
      });
    });
  }

  /* ── 根据 ID 查找服务器配置 ── */
  function getServer(id) {
    for (var i = 0; i < SERVERS.length; i++) {
      if (SERVERS[i].id === id) return SERVERS[i];
    }
    return null;
  }

  /* ── 切换服务器 ── */
  function switchServer(serverId) {
    if (serverId === _currentServerId) return;
    _currentServerId = serverId;

    // 更新按钮活跃状态
    document.querySelectorAll('.leida-tab').forEach(function (tab) {
      tab.classList.remove('active');
      if (tab.getAttribute('data-server') === serverId) {
        tab.classList.add('active');
      }
    });

    var target = getServer(serverId);
    if (!target) return;

    // 更新 iframe
    var iframe = document.getElementById('leidaIframe');
    if (iframe) {
      iframe.src = getIframeUrl(target);
    }

    // 更新信息栏 + fallback 按钮（始终使用直接 HTTP 地址）
    updateInfoBar(target);

    // 重置 fallback 状态，重新检测
    var fallback = document.getElementById('leidaFallback');
    if (fallback) {
      fallback.classList.remove('visible');

      var loaded = false;
      iframe.addEventListener('load', function onLoad() {
        loaded = true;
        fallback.classList.remove('visible');
        iframe.removeEventListener('load', onLoad);
      });

      setTimeout(function () {
        if (!loaded) {
          fallback.classList.add('visible');
        }
      }, 4000);
    }
  }

  /* ── 重置模块状态 ── */
  function resetModule() {
    _initialized = false;
    _currentServerId = 'svr1';
    _swReady = false;
  }

  /* ── 公开 API ── */
  return {
    render: render,
    resetRender: resetModule,
    switchServer: switchServer
  };
})();

Mode.ready(function () {
  Mode.Debug.log('Leida', '雷达模块就绪');
});