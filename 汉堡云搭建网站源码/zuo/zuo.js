/* ============================================================
   zuo.js — 左侧边栏交互逻辑
   功能: 收缩/展开 + 标签逐个显现 + 菜单状态管理
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-07] [SELF-CONTAINED]
   ============================================================ */

const Zuo = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    collapsedClass: 'zuo-su',
    staggerBase: 0.04,    // 每个标签的递增延迟 (秒)
    labelFadeIn: 0.3      // 标签淡入时长 (秒)
  };

  /* ── 内部状态 ── */
  let panel   = null;
  let toggle  = null;
  let isBusy  = false;    // 防止快速点击冲突
  let hamburger = null;   // 窄屏汉堡按钮
  let overlay   = null;   // 窄屏遮罩层
  let isOverlayMode = false; // 是否处于 overlay 展开模式
  let _preventAutoExpand = false; // 用户手动收缩后，禁止自动展开

  /* ── 窄屏下拉面板 (状态④) ── */
  let dropdown = null;
  let dropdownHandle = null;
  let isDropdownOpen = false;

  /* ── 初始化 ── */
  function init() {
    panel  = document.getElementById('zuo-panel');
    toggle = document.querySelector('.zuo-toggle');

    if (!panel || !toggle) {
      Mode.Debug.error('Zuo', '边栏元素缺失');
      return;
    }

    // 移除可能残留的旧监听器，确保只绑定一次
    toggle.removeEventListener('click', handleToggle);
    toggle.addEventListener('click', handleToggle);

    // 初始化汉堡按钮 & 遮罩层
    initHamburger();

    // 初始化响应式折叠
    initResponsive();

    // 初始化按钮文本，与面板当前状态同步
    syncToggleText();

    Mode.Debug.log('Zuo', '左侧边栏就绪');
  }

  /* ── 同步按钮文本与面板状态 ── */
  function syncToggleText() {
    if (!toggle || !panel) return;
    var isCollapsed = panel.classList.contains(CONFIG.collapsedClass);
    toggle.textContent = isCollapsed ? '▶' : '◀';
  }

  /* ── 点击切换 ── */
  function handleToggle() {
    if (isBusy) return;
    isBusy = true;

    // 如果在 overlay 模式（状态④），点击把手关闭面板回到状态③
    if (isOverlayMode) {
      closeOverlayPanel();
      setTimeout(function () { isBusy = false; }, 520);
      return;
    }

    const isCollapsed = panel.classList.contains(CONFIG.collapsedClass);

    if (isCollapsed) {
      // 用户手动展开 → 允许未来自动展开
      _preventAutoExpand = false;
      doExpand();
    } else {
      // 用户手动收缩 → 标记阻止自动展开
      _preventAutoExpand = true;
      doCollapse();
    }

    // 0.5s 后释放锁 (与 CSS transition 对齐)
    setTimeout(function () { isBusy = false; }, 520);
  }

  /* ── 展开 ── */
  function doExpand() {
    // 标题: 原位从小到大 + 透明度 0→1
    var title = document.querySelector('.zuo-title');
    title.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease';
    title.style.transform  = 'translateX(0) scale(1)';
    title.style.opacity    = '1';

    panel.classList.remove(CONFIG.collapsedClass);

    // 标签逐个显现
    var labels = document.querySelectorAll('.zuo-label');
    labels.forEach(function (el, i) {
      el.style.transition =
        'opacity ' + CONFIG.labelFadeIn + 's ease, ' +
        'margin-left 0.3s ease';
      el.style.transitionDelay = (i * CONFIG.staggerBase) + 's';
      el.style.opacity = '1';
      el.style.width   = '';
    });

    document.querySelectorAll('.zuo-icon').forEach(function (el) {
      el.style.transitionDelay = '0s';
    });

    toggle.textContent = '◀';

    // 展开时隐藏汉堡按钮
    if (hamburger) {
      hamburger.classList.remove('zuo-hamburger--show');
    }
  }

  /* ── 收起 ── */
  function doCollapse() {
    // 标题: 快速向左平移 + 缩小 + 淡出 (0.3s linear 匀速, 无缓动拖沓)
    var title = document.querySelector('.zuo-title');
    title.style.transition = 'transform 0.3s linear, opacity 0.25s linear';
    title.style.transform  = 'translateX(-150px) scale(0.6)';
    title.style.opacity    = '0';

    // 标签: 从上往下依次消失 (与展开的 stagger 对称)
    document.querySelectorAll('.zuo-label').forEach(function (el, i) {
      el.style.transition = 'opacity 0.15s linear';
      el.style.transitionDelay = (i * CONFIG.staggerBase) + 's';
      el.style.opacity = '0';
      el.style.width   = '0';
    });

    panel.classList.add(CONFIG.collapsedClass);

    toggle.textContent = '▶';

    // 如果子页开着, 收起时关闭
    if (_currentPage) {
      closePage();
    }

    // 如果在 overlay 模式下收起，也要关闭 overlay
    if (isOverlayMode) {
      exitOverlayMode();
    }
  }

  /* ================================================================
     子页系统 — 菜单项点击展开子页内容, 返回按钮回到主菜单
     外部使用: Zuo.registerPage('id', { title, content })
               content 支持 HTML 字符串 或 function() 返回 DOM
     ================================================================ */
  const _pages        = {};
  let   _currentPage  = null;
  let   _pageContainer = null;

  /* ── 切换主内容区页面 ── */
  function switchMainContent(pageId) {
    // 隐藏所有主内容区页面
    var shouyeSection = document.getElementById('shouyeSection');
    var shushukazhanbeiSection = document.getElementById('shushukazhanbeiSection');
    var awmzidanSection = document.getElementById('awmzidanSection');
    var maiwuziSection = document.getElementById('maiwuziSection');
    var paodaoSection = document.getElementById('paodaoSection');
    var guanyuSection = document.getElementById('guanyuSection');
    
    if (shouyeSection) shouyeSection.classList.remove('page-active');
    if (shushukazhanbeiSection) shushukazhanbeiSection.classList.remove('page-active');
    if (awmzidanSection) awmzidanSection.classList.remove('page-active');
    if (maiwuziSection) maiwuziSection.classList.remove('page-active');
    if (paodaoSection) paodaoSection.classList.remove('page-active');
    if (guanyuSection) guanyuSection.classList.remove('page-active');
    
    // 显示选中的页面
    if (pageId === 'shouye' && shouyeSection) {
      shouyeSection.classList.add('page-active');
    } else if (pageId === 'shushukazhanbei' && shushukazhanbeiSection) {
      shushukazhanbeiSection.classList.add('page-active');
    } else if (pageId === 'awmzidan' && awmzidanSection) {
      awmzidanSection.classList.add('page-active');
    } else if (pageId === 'maiwuzi' && maiwuziSection) {
      maiwuziSection.classList.add('page-active');
    } else if (pageId === 'paodao' && paodaoSection) {
      paodaoSection.classList.add('page-active');
    } else if (pageId === 'guanyu' && guanyuSection) {
      guanyuSection.classList.add('page-active');
      // 刷新赞赏记录（兼容 window 挂载和直接引用）
      var guanyuModule = window.GuanYu || GuanYu;
      if (guanyuModule && guanyuModule.reRender) {
        guanyuModule.reRender();
      } else {
        Mode.Debug.warn('Zuo', 'GuanYu 模块未就绪，无法刷新关于页面');
      }
    }
  }

  /* ── 初始化子页容器 + 事件委托 ── */
  function initPages() {
    _pageContainer = document.createElement('div');
    _pageContainer.className = 'zuo-page-container';
    panel.appendChild(_pageContainer);

    // 点击菜单项 → 打开子页或切换主内容区
    panel.addEventListener('click', function (e) {
      var item = e.target.closest('.zuo-item');
      if (item && item.dataset.page) {
        var pageId = item.dataset.page;
        
        // 更新菜单项的活跃状态
        document.querySelectorAll('.zuo-nav .zuo-item').forEach(function(el) {
          el.classList.remove('active');
        });
        item.classList.add('active');
        
        // 处理主内容区页面切换
        if (pageId === 'shouye' || pageId === 'shushukazhanbei' || pageId === 'awmzidan' || pageId === 'maiwuzi' || pageId === 'paodao' || pageId === 'guanyu') {
          switchMainContent(pageId);
          // 如果有子页系统的话，先关闭子页
          if (_currentPage) {
            closePage();
          }
        } else if (_pages[pageId]) {
          openPage(pageId);
        }
      }
      // 点击返回按钮 → 关闭子页
      if (e.target.closest('.zuo-page-back')) {
        closePage();
      }
    });
  }

  /* ── 注册子页 ── */
  function registerPage(id, config) {
    _pages[id] = config;
  }

  /* ── 打开子页 ── */
  function openPage(id) {
    var page = _pages[id];
    if (!page) return;
    _currentPage = id;

    _pageContainer.innerHTML = '';

    // 标题
    if (page.title) {
      var h = document.createElement('div');
      h.className = 'zuo-page-title';
      h.textContent = page.title;
      _pageContainer.appendChild(h);
    }

    // 正文
    if (page.content) {
      if (typeof page.content === 'string') {
        _pageContainer.insertAdjacentHTML('beforeend', page.content);
      } else if (typeof page.content === 'function') {
        var result = page.content();
        if (typeof result === 'string') {
          _pageContainer.insertAdjacentHTML('beforeend', result);
        } else if (result instanceof HTMLElement) {
          _pageContainer.appendChild(result);
        }
      }
    }

    // 返回按钮
    var back = document.createElement('div');
    back.className = 'zuo-page-back';
    back.textContent = '← 返回菜单';
    _pageContainer.appendChild(back);

    // 滑入
    _pageContainer.classList.add('active');
  }

  /* ── 关闭子页 ── */
  function closePage() {
    _pageContainer.classList.remove('active');
    _currentPage = null;
  }

  /* ── 修改 init, 加入子页初始化 ── */
  function originalInit() {}  // 占位, 下方替换

  /* 覆写 init 以包含子页系统 */
  init = (function (orig) {
    return function () {
      orig();
      if (panel) initPages();
    };
  })(init);

  /* ================================================================
     响应式折叠 — 两档阈值
     · 宽屏 (≥ thresholdCollapse): 正常展开
     · 中屏 (thresholdHide ~ thresholdCollapse): 自动收缩到 60px
     · 窄屏 (< thresholdHide): 完全隐藏面板，汉堡按钮从左上角淡入
     窄屏中点击汉堡 → 面板从左侧滑入 (overlay 模式)，按钮隐藏
     ================================================================ */
  function initResponsive() {
    var thresholdCollapse = 1100;
    var thresholdHide = 750;
    var resizeTimer = null;

    function checkWidth() {
      var w = window.innerWidth;

      if (w < thresholdHide) {
        // ── 窄屏：完全隐藏面板，显示汉堡按钮 ──
        if (!panel.classList.contains('zuo-hidden')) {
          // 如果当前处于 overlay 模式，先退出
          if (isOverlayMode) {
            exitOverlayMode();
          }
          // 收起展开状态
          if (!panel.classList.contains(CONFIG.collapsedClass)) {
            doCollapseSilent();
          }
          // 隐藏面板
          panel.classList.add('zuo-hidden');
        }
        // 显示汉堡按钮（确保面板已隐藏后再显示）
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          hamburger.classList.add('zuo-hamburger--show');
        }, 80);

      } else if (w < thresholdCollapse) {
        // ── 中屏：自动收缩到 60px（状态②，不显示汉堡） ──

        // 如果下拉面板开着，关闭它
        if (isDropdownOpen) {
          dropdown.classList.remove('zuo-dropdown--open');
          overlay.classList.remove('zuo-overlay--show');
          isDropdownOpen = false;
        }

        // 退出窄屏隐藏状态
        if (panel.classList.contains('zuo-hidden')) {
          panel.classList.remove('zuo-hidden');
        }
        if (isOverlayMode) {
          exitOverlayMode();
        }
        // 如果当前是展开的，自动收起
        if (!panel.classList.contains(CONFIG.collapsedClass)) {
          doCollapseSilent();
        }
        // 中屏不显示汉堡按钮
        hamburger.classList.remove('zuo-hamburger--show');

      } else {
        // ── 宽屏：仅在用户未手动阻止时自动展开 ──

        // 如果下拉面板开着，关闭它
        if (isDropdownOpen) {
          dropdown.classList.remove('zuo-dropdown--open');
          isDropdownOpen = false;
        }

        if (panel.classList.contains('zuo-hidden')) {
          panel.classList.remove('zuo-hidden');
        }
        if (isOverlayMode) {
          exitOverlayMode();
        }
        // 如果当前是收起的，且用户未阻止自动展开
        if (panel.classList.contains(CONFIG.collapsedClass) && !_preventAutoExpand) {
          doExpand();
        }
      }
    }

    window.addEventListener('resize', checkWidth);
    checkWidth(); // 初始检查
  }

  /* ── 静默收起 (不触发 overlay 退出) ── */
  function doCollapseSilent() {
    var title = document.querySelector('.zuo-title');
    title.style.transition = 'transform 0.3s linear, opacity 0.25s linear';
    title.style.transform  = 'translateX(-150px) scale(0.6)';
    title.style.opacity    = '0';

    document.querySelectorAll('.zuo-label').forEach(function (el, i) {
      el.style.transition = 'opacity 0.15s linear';
      el.style.transitionDelay = (i * CONFIG.staggerBase) + 's';
      el.style.opacity = '0';
      el.style.width   = '0';
    });

    panel.classList.add(CONFIG.collapsedClass);
    toggle.textContent = '▶';

    if (_currentPage) {
      closePage();
    }
  }

  /* ================================================================
     窄屏汉堡按钮 & 下拉面板 (状态④: 从上往下展开)
     ================================================================ */
  function initHamburger() {
    hamburger = document.getElementById('zuoHamburger');
    if (!hamburger) return;

    dropdown = document.getElementById('zuoDropdown');
    dropdownHandle = document.getElementById('zuoDropdownHandle');

    // 创建遮罩层
    overlay = document.createElement('div');
    overlay.className = 'zuo-overlay';
    document.body.appendChild(overlay);

    // 点击汉堡 → 显示下拉面板
    hamburger.addEventListener('click', function () {
      if (isBusy) return;
      // 立即隐藏汉堡按钮
      hamburger.classList.remove('zuo-hamburger--show');
      // 等汉堡淡出后，展开下拉面板
      clearTimeout(window._zuoHamburgerTimer);
      window._zuoHamburgerTimer = setTimeout(function () {
        showDropdown();
        isBusy = false;
      }, 420);
    });

    // 点击遮罩层 → 收起下拉面板或旧 overlay
    overlay.addEventListener('click', function (e) {
      if (isBusy) return;
      // 如果点的是把手，交给把手自己的点击事件处理
      if (e.target.closest('.zuo-dropdown-handle')) return;
      if (isDropdownOpen) {
        hideDropdown();
      } else {
        closeOverlayPanel();
      }
    });

    // 点击下拉面板的收起把手 → 收起
    if (dropdownHandle) {
      dropdownHandle.addEventListener('click', function () {
        if (isBusy) return;
        hideDropdown();
      });
    }

    // 点击下拉面板的菜单项 → 关闭面板并切换页面
    if (dropdown) {
      dropdown.addEventListener('click', function (e) {
        var item = e.target.closest('.zuo-item');
        if (item && !e.target.closest('.zuo-dropdown-handle')) {
          var pageId = item.dataset.page;
          if (pageId) {
            // 更新左侧菜单的活跃状态
            document.querySelectorAll('.zuo-nav .zuo-item').forEach(function(el) {
              el.classList.remove('active');
              if (el.dataset.page === pageId) {
                el.classList.add('active');
              }
            });
            // 切换主内容区
            switchMainContent(pageId);
          }
          hideDropdown();
        }
      });
    }

    // 点击下拉面板外部 → 关闭面板
    document.addEventListener('click', function (e) {
      if (!isDropdownOpen) return;
      if (!dropdown.contains(e.target)) {
        hideDropdown();
      }
    });
  }

  /* ── 展开下拉面板 ── */
  function showDropdown() {
    isDropdownOpen = true;

    // 写入所有菜单项
    var dropdownNav = document.getElementById('zuoDropdownNav');
    if (dropdownNav) {
      dropdownNav.innerHTML =
        '<div class="zuo-item" data-page="shouye">' +
          '<span class="zuo-label">首页</span>' +
        '</div>' +
        '<div class="zuo-item" data-page="shushukazhanbei">' +
          '<span class="zuo-label">鼠鼠卡战备</span>' +
        '</div>' +
        '<div class="zuo-item" data-page="awmzidan">' +
          '<span class="zuo-label">AW子弹报价</span>' +
        '</div>' +
        '<div class="zuo-item" data-page="paodao">' +
          '<span class="zuo-label">下单跑刀</span>' +
        '</div>' +
        '<div class="zuo-item" data-page="maiwuzi">' +
          '<span class="zuo-label">买物资+找锁车</span>' +
        '</div>' +
        '<div class="zuo-item" data-page="guanyu">' +
          '<span class="zuo-label">关于</span>' +
        '</div>';
    }

    // 下拉面板滑入 (translateY(-100%) → translateY(0))
    dropdown.classList.add('zuo-dropdown--open');
  }

  /* ── 收起下拉面板 ── */
  function hideDropdown() {
    isBusy = true;
    isDropdownOpen = false;

    // 隐藏遮罩
    overlay.classList.remove('zuo-overlay--show');

    // 下拉面板滑出 (translateY(0) → translateY(-100%))
    dropdown.classList.remove('zuo-dropdown--open');

    // 等面板完全收起后，重新显示汉堡按钮
    clearTimeout(window._zuoCloseTimer);
    window._zuoCloseTimer = setTimeout(function () {
      hamburger.classList.add('zuo-hamburger--show');
      isBusy = false;
    }, 500);
  }

  /* ── 进入 overlay 模式 ── */
  function enterOverlayMode() {
    isOverlayMode = true;
    panel.classList.add('zuo-overlay-mode');
    // 显示遮罩层（延迟一点点，等面板滑入后再淡入遮罩）
    setTimeout(function () {
      overlay.classList.add('zuo-overlay--show');
    }, 50);
  }

  /* ── 退出 overlay 模式 ── */
  function exitOverlayMode() {
    isOverlayMode = false;
    panel.classList.remove('zuo-overlay-mode');
    overlay.classList.remove('zuo-overlay--show');
  }

  /* ── 关闭 overlay 面板 ── */
  function closeOverlayPanel() {
    isBusy = true;

    // 如果下拉面板开着，先关掉
    if (isDropdownOpen) {
      dropdown.classList.remove('zuo-dropdown--open');
      isDropdownOpen = false;
    }

    // 隐藏遮罩
    overlay.classList.remove('zuo-overlay--show');

    // 收起面板
    panel.classList.add('zuo-hidden');
    exitOverlayMode();

    // 等面板完全滑出后，显示汉堡按钮
    clearTimeout(window._zuoCloseTimer);
    window._zuoCloseTimer = setTimeout(function () {
      hamburger.classList.add('zuo-hamburger--show');
      isBusy = false;
    }, 520);
  }

  /* 覆写 init 以包含子页系统 */
  init = (function (orig) {
    return function () {
      orig();
      if (panel) initPages();
    };
  })(init);

  /* ── 公开 API ── */
  return {
    init: init,
    config: CONFIG,

    // 子页系统
    registerPage: registerPage,
    openPage:     openPage,
    closePage:    closePage,

    // 窄屏 overlay 模式
    closeOverlayPanel: closeOverlayPanel,
    isOverlayMode: function () { return isOverlayMode; },

    // 工具方法: 供后续动态添加菜单项后重置标签状态
    refreshLabels: function () {
      document.querySelectorAll('.zuo-label').forEach(function (el) {
        el.style.transitionDelay = '0s';
        el.style.transition = 'opacity 0.3s ease, margin-left 0.3s ease';
        if (panel.classList.contains(CONFIG.collapsedClass)) {
          el.style.opacity = '0';
          el.style.width   = '0';
        } else {
          el.style.opacity = '1';
          el.style.width   = '';
        }
      });
    },

    // 强制重新同步按钮状态 (外部可调用)
    syncToggle: syncToggleText
  };
})();

/* 页面就绪后自动启动 */
Mode.ready(function () {
  Zuo.init();
});