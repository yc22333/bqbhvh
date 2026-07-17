/* ============================================================
   riye.js — 白昼/极夜 模式切换
   功能：切换 data-theme 属性，localStorage 持久化
   依赖：无（在 mode.js 之前加载）
   ============================================================ */
(function() {
  'use strict';

  const STORAGE_KEY = 'biqibao_theme';
  const THEME_DAY = 'day';
  const THEME_NIGHT = 'night';

  /* ── 获取当前主题 ── */
  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || THEME_DAY;
  }

  /* ── 设置主题 ── */
  function setTheme(theme) {
    if (theme === THEME_NIGHT) {
      document.documentElement.setAttribute('data-theme', THEME_NIGHT);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch(e) { /* ignore */ }
  }

  /* ── 切换主题 ── */
  function toggleTheme() {
    var current = getTheme();
    var next = (current === THEME_NIGHT) ? THEME_DAY : THEME_NIGHT;
    setTheme(next);
    updateButtons();
  }

  /* ── 更新所有切换按钮的状态 ── */
  function updateButtons() {
    var isNight = getTheme() === THEME_NIGHT;
    var buttons = document.querySelectorAll('.riye-toggle-btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var icon = btn.querySelector('.zuo-icon');
      var label = btn.querySelector('.zuo-label');
      if (icon && label) {
        icon.textContent = isNight ? '🌙' : '☀️';
        label.textContent = isNight ? '极夜模式' : '白昼模式';
      } else {
        btn.textContent = isNight ? '🌙 极夜模式' : '☀️ 白昼模式';
      }
      if (isNight) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  /* ── 绑定切换按钮（支持动态添加） ── */
  function bindToggle() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.riye-toggle-btn');
      if (btn) {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  /* ── 初始化 ── */
  function init() {
    // 恢复保存的主题
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === THEME_NIGHT) {
        document.documentElement.setAttribute('data-theme', THEME_NIGHT);
      }
    } catch(e) { /* ignore */ }

    // DOM 就绪后更新按钮显示
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateButtons);
    } else {
      updateButtons();
    }

    // 绑定事件
    bindToggle();
  }

  init();
})();