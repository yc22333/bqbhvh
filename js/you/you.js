/* ============================================================
   you.js — 右侧边栏 · 音乐播放器交互
   功能: 声纹可视化动画 + 播放控制状态管理
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-07] [SELF-CONTAINED]
   ============================================================ */

const You = (() => {
  'use strict';

  /* ── 内部状态 ── */
  let panel      = null;
  let audio      = null;
  let musicList  = ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3', '7.mp3', '8.mp3', '9.mp3', '10.mp3', '11.mp3']; 
  let currentIdx = -1;
  let isPlaying  = false;
  let expandBtn  = null;
  let _pendingPlay = false; // 音频就绪后自动播放
  let _dragData  = null;    // 拖拽状态数据

  /* ── 初始化 ── */
  function init() {
    panel = document.getElementById('you-panel');
    if (!panel) {
      if (Mode && Mode.Debug) Mode.Debug.error('You', '右边栏元素缺失');
      return;
    }

    audio = document.getElementById('youAudio');
    audio.volume = 0.3; // 初始音量 30%

    // 初始化展开按钮
    initExpandBtn();

    // 初始化底部面板收起按钮
    initHideBtn();

    // 随机选一首并加载
    pickRandom();
    loadTrack(currentIdx);
    bindAudioEvents();
    initControls();

    // 响应式折叠（窗口缩窄时自动隐藏）
    initResponsive();

    // 持久化监听音频就绪 → 自动播放（切换曲目/初始化均生效）
    audio.addEventListener('canplay', onTrackReady);

    // 尝试自动播放
    tryAutoPlay();

    updatePlayBtn();
    initBarChart();

    Mode.Debug.log('You', '右侧边栏就绪');
  }

  /* ================================================================
     展开按钮 — 点击展开侧栏
     ================================================================ */
  function initExpandBtn() {
    expandBtn = document.getElementById('youExpandBtn');
    if (!expandBtn) return;

    // 加载上次拖拽保存的位置
    loadSavedPosition();

    // 点击展开：先隐藏按钮，等按钮完全消失（420ms）后再展开面板
    expandBtn.addEventListener('click', function () {
      // 如果刚刚拖拽过，忽略此次点击
      if (expandBtn._wasDragged) {
        expandBtn._wasDragged = false;
        return;
      }

      // ① 立即隐藏按钮（触发 0.4s 淡出过渡）
      expandBtn.classList.remove('you-expand-btn--show');

      // ② 强制切换到底部面板模式，确保绝不触发右侧边栏
      //     右菜单栏与下菜单栏是独立分区，永远不联动
      if (!panel.classList.contains('you-bottom')) {
        panel.classList.add('you-no-transition');
        panel.classList.add('you-bottom');
        void panel.offsetHeight;
        panel.classList.remove('you-no-transition');
      }

      // ③ 等按钮完全隐藏后，再展开面板（从底部滑入）
      clearTimeout(window._youExpandTimer);
      window._youExpandTimer = setTimeout(function () {
        panel.classList.remove('you-su');
      }, 420);
    });

    // 初始化拖拽
    initDrag();
  }

  /* ================================================================
     拖拽功能 — 用户可自由拖动按钮位置
     ================================================================ */
  function initDrag() {
    if (!expandBtn) return;

    expandBtn.addEventListener('pointerdown', onDragStart);
  }

  function onDragStart(e) {
    // 只响应主鼠标按钮（左键）
    if (e.button !== 0) return;

    e.preventDefault();

    var rect = expandBtn.getBoundingClientRect();

    // 从 right/bottom 定位切换到 left/top 定位，方便拖拽计算
    expandBtn.style.right = 'auto';
    expandBtn.style.bottom = 'auto';
    expandBtn.style.left = rect.left + 'px';
    expandBtn.style.top = rect.top + 'px';

    // 添加拖拽样式（禁止过渡，放大反馈）
    expandBtn.classList.add('you-expand-btn--dragging');

    // 记录拖拽起始数据
    _dragData = {
      startX:    e.clientX,
      startY:    e.clientY,
      origLeft:  rect.left,
      origTop:   rect.top
    };

    expandBtn._wasDragged = false;

    // 全局监听移动和释放
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup',   onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    e.preventDefault();
    if (!_dragData) return;

    var dx = e.clientX - _dragData.startX;
    var dy = e.clientY - _dragData.startY;

    // 移动超过 5px 视为拖拽（而非点击）
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      expandBtn._wasDragged = true;
    }

    // 计算新位置
    var newLeft = _dragData.origLeft + dx;
    var newTop  = _dragData.origTop  + dy;

    // 限制在视口内，保留 8px 边距
    var padding = 8;
    var btnW = expandBtn.offsetWidth;
    var btnH = expandBtn.offsetHeight;
    newLeft = Math.max(padding, Math.min(window.innerWidth  - btnW - padding, newLeft));
    newTop  = Math.max(padding, Math.min(window.innerHeight - btnH - padding, newTop));

    expandBtn.style.left = newLeft + 'px';
    expandBtn.style.top  = newTop  + 'px';
  }

  function onDragEnd() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup',   onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);

    if (expandBtn) {
      expandBtn.classList.remove('you-expand-btn--dragging');
    }

    _dragData = null;

    // 保存位置到 localStorage
    savePosition();
  }

  /* ── 从 localStorage 恢复上次拖拽位置 ── */
  function loadSavedPosition() {
    try {
      var saved = localStorage.getItem('you_expand_btn_pos');
      if (!saved) return;
      var pos = JSON.parse(saved);
      if (typeof pos.left !== 'number' || typeof pos.top !== 'number') return;

      expandBtn.style.right  = 'auto';
      expandBtn.style.bottom = 'auto';
      expandBtn.style.left   = pos.left + 'px';
      expandBtn.style.top    = pos.top  + 'px';
    } catch (e) {
      // 静默失败
    }
  }

  /* ── 保存拖拽位置到 localStorage ── */
  function savePosition() {
    try {
      var left = parseFloat(expandBtn.style.left);
      var top  = parseFloat(expandBtn.style.top);
      if (isNaN(left) || isNaN(top)) return;

      localStorage.setItem('you_expand_btn_pos', JSON.stringify({
        left: left,
        top:  top
      }));
    } catch (e) {
      // 静默失败
    }
  }

  /* ================================================================
     底部面板收起按钮 — 点击后面板滑下，展开按钮淡出
     ================================================================ */
  function initHideBtn() {
    var hideBtn = panel.querySelector('.you-hide-btn');
    if (!hideBtn) return;

    hideBtn.addEventListener('click', function () {
      // ① 立即收起面板（触发 0.4s 滑下过渡）
      panel.classList.add('you-su');

      // ② 等面板完全隐藏后，再淡出展开按钮
      clearTimeout(window._youHideTimer);
      window._youHideTimer = setTimeout(function () {
        expandBtn.classList.add('you-expand-btn--show');
      }, 420);
    });
  }

  /* ================================================================
     响应式折叠 — 窄屏切换为底部面板模式
     · 宽屏→窄屏：先向右滑出隐藏 → 再静默切换底部面板 → 按钮从右下角淡入
     · 窄屏→宽屏：先滑出底部隐藏 → 再静默切回右侧模式 → 从右侧滑入
     · 窄屏中：点击按钮从底部向上展开，内容横向布局
     ================================================================ */
  function initResponsive() {
    var threshold = 900;
    var resizeTimer = null;
    var isNarrow = null;

    /* ── 统一模式应用（由 resize 触发） ── */
    function applyMode() {
      var nowNarrow = window.innerWidth < threshold;
      if (nowNarrow === isNarrow) return;
      isNarrow = nowNarrow;

      if (nowNarrow) {
        // ── 宽屏→窄屏：向右滑出隐藏 ──
        if (!panel.classList.contains('you-bottom')) {
          panel.classList.add('you-su');
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            if (window.innerWidth >= threshold) return;
            panel.classList.add('you-no-transition');
            panel.classList.add('you-bottom');
            panel.classList.add('you-su');
            void panel.offsetHeight;
            panel.classList.remove('you-no-transition');
            expandBtn.classList.add('you-expand-btn--show');
          }, 520);
        } else {
          panel.classList.add('you-su');
          expandBtn.classList.add('you-expand-btn--show');
        }
      } else {
        // ── 窄屏→宽屏：从右侧滑入 ──
        if (panel.classList.contains('you-bottom')) {
          expandBtn.classList.remove('you-expand-btn--show');
          panel.classList.add('you-su');
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            if (window.innerWidth < threshold) return;
            panel.classList.add('you-no-transition');
            panel.classList.remove('you-bottom');
            void panel.offsetHeight;
            panel.classList.remove('you-no-transition');
            requestAnimationFrame(function () {
              panel.classList.remove('you-su');
            });
          }, 420);
        } else {
          panel.classList.remove('you-su');
          expandBtn.classList.remove('you-expand-btn--show');
        }
      }
    }

    /* ── 使用 requestAnimationFrame 节流，确保缩放流畅 ── */
    var rafId = null;
    window.addEventListener('resize', function () {
      if (!expandBtn) return;
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = null;
        applyMode();
      });
    });

    /* ── 初始化：直接进入正确状态，跳过首次动画 ── */
    isNarrow = window.innerWidth < threshold;
    if (isNarrow) {
      // 首次加载窄屏：无闪烁直接进入底部隐藏模式
      panel.classList.add('you-no-transition');
      panel.classList.add('you-bottom');
      panel.classList.add('you-su');
      void panel.offsetHeight;
      panel.classList.remove('you-no-transition');
      expandBtn.classList.add('you-expand-btn--show');
    } else {
      panel.classList.remove('you-su');
      expandBtn.classList.remove('you-expand-btn--show');
    }
  }

  /* ================================================================
     音频就绪回调 — 当曲目加载到可播放状态时自动播放
     ================================================================ */
  function onTrackReady() {
    if (!_pendingPlay) return;
    _pendingPlay = false;

    audio.muted = false;
    var p = audio.play();
    if (p) {
      p.then(function () {
        isPlaying = true;
        updatePlayBtn();
        Mode.Debug.log('You', '自动播放');
      }).catch(function () {
        isPlaying = false;
        updatePlayBtn();
        Mode.Debug.log('You', '自动播放被阻止');
      });
    }
  }

  /* ================================================================
     尝试自动播放（首次加载）
     策略: 静音播放绕过浏览器策略 → 成功后取消静音
     ================================================================ */
  function tryAutoPlay() {
    if (!audio || !audio.src || isPlaying) return;
    if (audio.readyState < 2) {
      _pendingPlay = true;  // 等 canplay 事件触发
      return;
    }

    audio.muted = true;
    var p = audio.play();
    if (p) {
      p.then(function () {
        isPlaying = true;
        updatePlayBtn();
        setTimeout(function () { audio.muted = false; }, 50);
      }).catch(function () {
        // 静音也被阻止 → 等用户交互后再试
        audio.muted = false;
        _pendingPlay = true;
      });
    }
  }

  /* ================================================================
     随机选曲
     ================================================================ */
  function pickRandom() {
    if (musicList.length === 0) return;
    currentIdx = Math.floor(Math.random() * musicList.length);
  }

  /* ================================================================
     加载指定索引的曲目
     ================================================================ */
  function loadTrack(idx) {
    if (idx < 0 || idx >= musicList.length) return;
    currentIdx = idx;
    var fileName = musicList[currentIdx];
    var src = 'music/beijingyinyue/' + encodeURIComponent(fileName);
    audio.src = src;
    audio.load();

    // 更新显示: 去掉扩展名
    var displayName = fileName.replace(/\.(mp3|wav|flac|aac|ogg|m4a)$/i, '');
    Mode.Debug.log('You', '加载曲目: ' + displayName);
  }

  /* ================================================================
     绑定音频事件 (播放结束自动下一曲)
     ================================================================ */
  function bindAudioEvents() {
    if (!audio) return;

    audio.addEventListener('ended', function () {
      nextTrack();
    });

    audio.addEventListener('error', function () {
      Mode.Debug.log('You', '音频加载失败，跳过下一曲');
      nextTrack();
    });
  }

  /* ================================================================
     柱状图声纹 — 动态生成随机高度柱条
     ================================================================ */
  function initBarChart() {
    var container = document.getElementById('youBarchart');
    if (!container) return;
    var count = 22;
    for (var i = 0; i < count; i++) {
      var bar = document.createElement('div');
      bar.className = 'you-bchart-bar';
      bar.style.height       = (12 + Math.random() * 30) + 'px';
      bar.style.animationDelay    = (Math.random() * 2).toFixed(2) + 's';
      bar.style.animationDuration = (0.7 + Math.random() * 0.5).toFixed(2) + 's';
      container.appendChild(bar);
    }
  }

  /* ================================================================
     播放控件 — 上一曲 / 播放暂停 / 下一曲
     ================================================================ */
  function initControls() {
    var playBtn = document.querySelector('.you-btn-play');
    var prevBtn = document.querySelector('.you-btn-prev');
    var nextBtn = document.querySelector('.you-btn-next');

    if (playBtn) playBtn.addEventListener('click', togglePlay);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
  }

  function play() {
    if (!audio || !audio.src) return;

    // 音频还没加载好，等 onTrackReady 回调处理
    if (audio.readyState < 2) {
      _pendingPlay = true;
      Mode.Debug.log('You', '等待音频加载…');
      return;
    }

    _pendingPlay = false;
    audio.muted = false;
    var p = audio.play();
    if (p) {
      p.then(function () {
        isPlaying = true;
        updatePlayBtn();
        Mode.Debug.log('You', '播放');
      }).catch(function () {
        // 一次失败后等 500ms 重试
        setTimeout(function () {
          if (!audio || !audio.src) return;
          audio.play().then(function () {
            isPlaying = true;
            updatePlayBtn();
            Mode.Debug.log('You', '播放');
          }).catch(function () {
            isPlaying = false;
            updatePlayBtn();
            Mode.Debug.log('You', '播放失败');
          });
        }, 500);
      });
    }
    updatePlayBtn();
  }

  function pause() {
    if (!audio) return;
    isPlaying = false;
    _pendingPlay = false; // 取消待播放标记
    audio.pause();
    updatePlayBtn();
    Mode.Debug.log('You', '暂停');
  }

  function togglePlay() {
    if (!audio || !audio.src) {
      if (musicList.length > 0) {
        pickRandom();
        _pendingPlay = true;  // 加载后立即播放
        loadTrack(currentIdx);
      }
      return;
    }
    if (isPlaying) {
      pause();
    } else {
      // 清除待播放标记，让 play() 重新判断
      _pendingPlay = false;
      play();
    }
  }

  function updatePlayBtn() {
    var btn = document.querySelector('.you-btn-play');
    if (!btn) return;
    btn.textContent = isPlaying ? '' : '▶';
    btn.classList.toggle('playing', isPlaying);
  }

  function prevTrack() {
    if (musicList.length === 0) return;
    currentIdx = (currentIdx - 1 + musicList.length) % musicList.length;
    _pendingPlay = isPlaying; // 如果正在播放，等新曲目加载后自动播放
    loadTrack(currentIdx);
    Mode.Debug.log('You', '上一曲');
  }

  function nextTrack() {
    if (musicList.length === 0) return;
    currentIdx = (currentIdx + 1) % musicList.length;
    _pendingPlay = isPlaying; // 如果正在播放，等新曲目加载后自动播放
    loadTrack(currentIdx);
    Mode.Debug.log('You', '下一曲');
  }

  /* ================================================================
     清理 (页面卸载时调用)
     ================================================================ */
  function destroy() {
    if (audio) {
      audio.pause();
      audio.src = '';
    }
  }

  /* ── 公开 API ── */
  return {
    init:    init,
    destroy: destroy,
    play:    play,
    pause:   pause,
    next:    nextTrack,
    prev:    prevTrack
  };
})();

/* 页面就绪后自动启动 */
Mode.ready(function () {
  You.init();
});