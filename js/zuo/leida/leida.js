/* ============================================================
   leida.js — 雷达页面逻辑
   功能: 展示两个服务器卡片，点击直接跳转访问
   [CREATED: 2026-09-15] [UPDATED: 2026-09-15]
   ============================================================ */

const Leida = (() => {
  'use strict';

  /* ── 服务器配置（在这里修改地址） ── */
  const SERVERS = [
    {
      id: 'svr1',
      name: '一号服务器',
      url: 'http://118.195.177.91:2083/',
      icon: '🖥️',
      desc: '主服务器 · 高防线路'
    },
    {
      id: 'svr2',
      name: '二号服务器',
      url: 'http://27.102.134.119:2083/',
      icon: '🛡️',
      desc: '备用服务器 · 自动切换'
    }
  ];

  let _initialized = false;

  /* ── 渲染页面 ── */
  function render() {
    var container = document.getElementById('leidaContent');
    if (!container) return;

    if (!_initialized) {
      buildUI(container);
      _initialized = true;
    }
  }

  /* ── 构建 UI（只执行一次） ── */
  function buildUI(container) {
    var noticeHtml =
      '<div class="leida-notice">' +
        '<div class="leida-notice-title">💡 购买激活码</div>' +
        '<div class="leida-notice-text">联系群主 <strong>章鱼哥</strong> 购买激活码</div>' +
        '<div class="leida-notice-price">60 / 天 &nbsp;|&nbsp; 380 / 周</div>' +
      '</div>';

    var cardsHtml = '';
    SERVERS.forEach(function (svr) {
      cardsHtml +=
        '<a class="leida-card" href="' + svr.url + '" target="_self" rel="noopener noreferrer">' +
          '<div class="leida-card-icon">' + svr.icon + '</div>' +
          '<div class="leida-card-info">' +
            '<div class="leida-card-name">' + svr.name + '</div>' +
            '<div class="leida-card-desc">' + svr.desc + '</div>' +
          '</div>' +
          '<div class="leida-card-arrow">➝</div>' +
        '</a>';
    });

    var html =
      noticeHtml +
      '<div class="leida-server-list">' +
        cardsHtml +
      '</div>' +
      '<div class="leida-disclaimer">' +
        '<div class="leida-disclaimer-line">重瞳已是无敌路，是挂三分毒，封号只是迟早的，小号娱乐即可，切勿使用大号</div>' +
        '<div class="leida-disclaimer-line">只提供激活码提供使用，一切后果自行承担</div>' +
      '</div>';

    container.innerHTML = html;
  }

  /* ── 重置模块状态 ── */
  function resetModule() {
    _initialized = false;
  }

  /* ── 公开 API ── */
  return {
    render: render,
    resetRender: resetModule
  };
})();

Mode.ready(function () {
  Mode.Debug.log('Leida', '雷达模块就绪');
});