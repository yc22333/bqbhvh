// ============================================================
// youxi1.js — 气泡点击游戏（游戏一）+ 游戏选项卡管理器
// 功能: 负责渲染三个游戏的选项卡导航 + 气泡点击游戏逻辑
// 风格: 参考 awm.js 选项卡交互 + paodao.js 动态渲染
// [CREATED: 2026-06-11]
// ============================================================

const Game1 = (() => {
  'use strict';

  const CONFIG = { debugTag: 'Game1' };

  /* ── 全局游戏管理器 ── */
  window.GameManager = window.GameManager || {
    games: {},
    register: function(name, renderFn) {
      this.games[name] = renderFn;
    },
    switchTo: function(name) {
      document.querySelectorAll('.g1-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelectorAll('.g1-tab').forEach(function(t) { t.classList.remove('active'); });
      var tab = document.querySelector('.g1-tab[data-game="' + name + '"]');
      var panel = document.getElementById('g1Panel' + name);
      if (tab) tab.classList.add('active');
      if (panel) panel.classList.add('active');
    }
  };

  let initialized = false;
  let container = null;

  /* ── 游戏状态 ── */
  let state = {
    difficulty: 'easy',  // easy | hard | hell
    score: 0,
    total: 0,
    missed: 0,
    timeLeft: 60,
    isRunning: false,
    timer: null,
    spawnTimer: null,
  };

  /* ── 难度配置 ── */
  const DIFF = {
    easy:  { size: [50,70], spawnInterval: 1200, lifeTime: 2500, color: 'easy' },
    hard:  { size: [35,50], spawnInterval: 900,  lifeTime: 1800, color: 'hard' },
    hell:  { size: [22,35], spawnInterval: 650,  lifeTime: 1200, color: 'hell' },
  };

  /* ── 渲染游戏容器 ── */
  function renderContent() {
    container = document.getElementById('laoquyouxiContent');
    if (!container) { Mode.Debug.warn(CONFIG.debugTag, 'DOM #laoquyouxiContent 不存在'); return; }

    container.innerHTML = '';

    var frag = document.createDocumentFragment();
    function APP(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); }

    // 选项卡导航
    APP('<div class="g1-tabs">' +
      '<div class="g1-tab active" data-game="Game1">🎯 气泡点击</div>' +
      '<div class="g1-tab" data-game="Game2">⚡ 反应训练</div>' +
      '<div class="g1-tab" data-game="Game3">⛏️ 挂机挖宝</div>' +
    '</div>');

    // Game1 面板
    APP('<div class="g1-panel active" id="g1PanelGame1">' +
      '<div class="g1-diff-row">' +
        '<div class="g1-diff-btn active" data-diff="easy">🟢 简单</div>' +
        '<div class="g1-diff-btn" data-diff="hard">🔵 困难</div>' +
        '<div class="g1-diff-btn" data-diff="hell">🔴 地狱</div>' +
      '</div>' +
      '<div class="g1-info">' +
        '<div class="g1-info-item"><div class="g1-info-label">⏱ 时间</div><div class="g1-info-value" id="g1Timer">60s</div></div>' +
        '<div class="g1-info-item"><div class="g1-info-label">🎯 得分</div><div class="g1-info-value" id="g1ScoreDisplay">0</div></div>' +
        '<div class="g1-info-item"><div class="g1-info-label">✅ 命中</div><div class="g1-info-value" id="g1HitDisplay">0/0</div></div>' +
      '</div>' +
      '<div class="g1-game-box" id="g1GameBox">' +
        '<div class="g1-hint">点击「开始游戏」挑战</div>' +
        '<div class="g1-overlay" id="g1Overlay"><div class="g1-overlay-text" id="g1OverlayText">⏰ 时间到！</div></div>' +
      '</div>' +
      '<div class="g1-result" id="g1Result">' +
        '<div class="g1-result-title">📊 本次战绩</div>' +
        '<div class="g1-result-grid">' +
          '<div class="g1-result-item"><div class="g1-result-label">命中率</div><div class="g1-result-value" id="g1rAccuracy">0%</div></div>' +
          '<div class="g1-result-item"><div class="g1-result-label">最快速度</div><div class="g1-result-value" id="g1rSpeed">0ms</div></div>' +
          '<div class="g1-result-item"><div class="g1-result-label">漏接率</div><div class="g1-result-value" id="g1rMissed">0%</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="g1-ctrl">' +
        '<button class="g1-ctrl-btn g1-btn-start" id="g1StartBtn">🎮 开始游戏</button>' +
        '<button class="g1-ctrl-btn g1-btn-leaderboard" id="g1SubmitBtn">🏆 提交成绩</button>' +
      '</div>' +
      '<!-- 排行榜嵌入区 -->' +
      '<div class="g1-lb-section" id="g1LbSectionGame1">' +
        '<div class="g1-lb-header">🏆 实时排行榜 <span class="g1-lb-mode" id="lbMode_game1">💻 本地</span></div>' +
        '<div class="g1-lb-name-row">' +
          '<span class="g1-lb-name-label">👤 玩家</span>' +
          '<input class="g1-lb-name-input" id="lbNameInput_game1" type="text" placeholder="输入你的名字" maxlength="12">' +
        '</div>' +
        '<div class="g1-lb-list" id="lbList_game1"><div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无记录</div></div></div>' +
      '</div>' +
    '</div>');

    // Game2 面板（占位，由 youxi2.js 填充）
    APP('<div class="g1-panel" id="g1PanelGame2"><div style="text-align:center;color:#8ab4c8;padding:40px 0;">⏳ 反应训练模块加载中...</div></div>');

    // Game3 面板（占位，由 youxi3.js 填充）
    APP('<div class="g1-panel" id="g1PanelGame3"><div style="text-align:center;color:#8ab4c8;padding:40px 0;">⏳ 挂机挖宝模块加载中...</div></div>');

    container.appendChild(frag);
    Mode.Debug.log(CONFIG.debugTag, '选项卡+Game1渲染完成 ✅');
  }

  /* ── 绑定事件 ── */
  function bindEvents() {
    if (!container) return;

    // 选项卡切换
    container.querySelectorAll('.g1-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var game = this.dataset.game;
        window.GameManager.switchTo(game);
        // 如果切换到进行中的 Game1，暂停游戏
        if (game !== 'Game1' && state.isRunning) {
          stopGame();
        }
      });
    });

    // 难度选择
    container.querySelectorAll('.g1-diff-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (state.isRunning) return;
        container.querySelectorAll('.g1-diff-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        state.difficulty = this.dataset.diff;
        resetDisplay();
      });
    });

    // 开始按钮
    var startBtn = document.getElementById('g1StartBtn');
    if (startBtn) startBtn.addEventListener('click', function() {
      if (state.isRunning) {
        stopGame();
      } else {
        startGame();
      }
    });

    // 玩家名输入框
    var nameInput = document.getElementById('lbNameInput_game1');
    if (nameInput) {
      if (typeof PaiHangBang !== 'undefined') nameInput.value = PaiHangBang.getPlayerName();
      nameInput.addEventListener('change', function() {
        if (typeof PaiHangBang !== 'undefined') PaiHangBang.setPlayerName(this.value);
      });
      nameInput.addEventListener('blur', function() {
        if (typeof PaiHangBang !== 'undefined') PaiHangBang.setPlayerName(this.value);
      });
    }

    // 提交成绩按钮
    var submitBtn = document.getElementById('g1SubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitToLeaderboard);
  }

  /* ── 手动提交成绩到排行榜 ── */
  function submitToLeaderboard() {
    if (typeof PaiHangBang === 'undefined' || !PaiHangBang.submitScore) {
      alert('排行榜模块未加载！');
      return;
    }
    var total = state.total;
    if (total <= 0) {
      alert('还没有游戏成绩！先玩一局再提交吧。');
      return;
    }
    var hit = state.score;
    var accuracy = total > 0 ? ((hit / total) * 100).toFixed(1) : 0;
    PaiHangBang.submitScore('game1', hit, {
      accuracy: accuracy,
      difficulty: state.difficulty === 'easy' ? '简单' : (state.difficulty === 'hard' ? '困难' : '地狱'),
      missed: state.missed,
      total: total
    });
  }

  /* ── 重置显示 ── */
  function resetDisplay() {
    document.getElementById('g1Timer').textContent = '60s';
    document.getElementById('g1ScoreDisplay').textContent = '0';
    document.getElementById('g1HitDisplay').textContent = '0/0';
    document.getElementById('g1Result').style.display = 'none';
    document.getElementById('g1Overlay').classList.remove('show');
    var hint = container.querySelector('.g1-hint');
    if (hint) hint.style.display = 'block';
    clearBubbles();
  }

  /* ── 清除气泡 ── */
  function clearBubbles() {
    var box = document.getElementById('g1GameBox');
    if (!box) return;
    box.querySelectorAll('.g1-bubble').forEach(function(b) { b.remove(); });
  }

  /* ── 开始游戏 ── */
  function startGame() {
    if (state.isRunning) return;
    state.isRunning = true;
    state.score = 0;
    state.total = 0;
    state.missed = 0;
    state.timeLeft = 60;

    document.getElementById('g1Result').style.display = 'none';
    document.getElementById('g1Overlay').classList.remove('show');
    var hint = container.querySelector('.g1-hint');
    if (hint) hint.style.display = 'none';

    var startBtn = document.getElementById('g1StartBtn');
    startBtn.textContent = '⏹ 结束游戏';
    startBtn.className = 'g1-ctrl-btn g1-btn-quit';

    clearBubbles();
    updateDisplay();

    state.timer = setInterval(function() {
      state.timeLeft--;
      updateDisplay();
      if (state.timeLeft <= 0) {
        endGame();
      }
    }, 1000);

    spawnBubble();
    var cfg = DIFF[state.difficulty];
    state.spawnTimer = setInterval(spawnBubble, cfg.spawnInterval);
  }

  /* ── 停止游戏 ── */
  function stopGame() {
    if (!state.isRunning) return;
    state.isRunning = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.spawnTimer) { clearInterval(state.spawnTimer); state.spawnTimer = null; }
    clearBubbles();

    var startBtn = document.getElementById('g1StartBtn');
    startBtn.textContent = '🎮 开始游戏';
    startBtn.className = 'g1-ctrl-btn g1-btn-start';

    var hint = container.querySelector('.g1-hint');
    if (hint) hint.style.display = 'block';
  }

  /* ── 结束游戏 ── */
  function endGame() {
    stopGame();

    var total = state.total;
    var hit = state.score;
    var miss = state.missed;
    var accuracy = total > 0 ? ((hit / total) * 100).toFixed(1) : 0;
    var missRate = total > 0 ? ((miss / total) * 100).toFixed(1) : 0;

    document.getElementById('g1rAccuracy').textContent = accuracy + '%';
    document.getElementById('g1rSpeed').textContent = '—';
    document.getElementById('g1rMissed').textContent = missRate + '%';
    document.getElementById('g1Result').style.display = 'block';

    var overlay = document.getElementById('g1Overlay');
    overlay.querySelector('.g1-overlay-text').textContent = '⏰ 游戏结束！得分: ' + hit + '（点击下方「提交成绩」按钮上榜）';
    overlay.classList.add('show');
  }

  /* ── 生成气泡 ── */
  function spawnBubble() {
    if (!state.isRunning) return;
    var cfg = DIFF[state.difficulty];
    var box = document.getElementById('g1GameBox');
    if (!box) return;

    var size = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
    var maxX = box.clientWidth - size - 10;
    var maxY = box.clientHeight - size - 10;
    if (maxX <= 0 || maxY <= 0) return;

    var x = 10 + Math.random() * maxX;
    var y = 10 + Math.random() * maxY;

    var bubble = document.createElement('div');
    bubble.className = 'g1-bubble ' + cfg.color;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
    bubble.textContent = '';

    state.total++;
    updateDisplay();

    // 点击事件
    bubble.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!state.isRunning) return;
      state.score++;
      updateDisplay();
      this.remove();
    });

    // 自动消失（漏接）
    var timeout = setTimeout(function() {
      if (bubble.parentNode && state.isRunning) {
        state.missed++;
        updateDisplay();
        bubble.remove();
      }
    }, cfg.lifeTime);

    bubble.dataset.timeout = timeout;
    box.appendChild(bubble);
  }

  /* ── 更新显示 ── */
  function updateDisplay() {
    document.getElementById('g1Timer').textContent = state.timeLeft + 's';
    document.getElementById('g1ScoreDisplay').textContent = state.score;
    var total = state.total;
    document.getElementById('g1HitDisplay').textContent = state.score + '/' + total;
  }

  /* ── 初始化排行榜嵌入区 ── */
  function initLeaderboard() {
    if (typeof PaiHangBang === 'undefined') return;
    // 填充玩家名称
    var nameInput = document.getElementById('lbNameInput_game1');
    if (nameInput) {
      nameInput.value = PaiHangBang.getPlayerName();
      nameInput.addEventListener('change', function() { PaiHangBang.setPlayerName(this.value); });
      nameInput.addEventListener('blur', function() { PaiHangBang.setPlayerName(this.value); });
    }
    // 渲染排行榜
    var listEl = document.getElementById('lbList_game1');
    if (listEl) PaiHangBang.renderRankList(listEl, 'game1');
  }

  /* ── 停止游戏（清理资源） ── */
  function stop() {
    // 只停止当前游戏的运行，不清理游戏框架
    if (state.isRunning) {
      stopGame();
    }
    Mode.Debug.log(CONFIG.debugTag, '气泡点击游戏已停止');
  }

  /* ── 公共初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;
    renderContent();
    bindEvents();
    initLeaderboard();
    Mode.Debug.log(CONFIG.debugTag, '气泡点击游戏已就绪 ✅');
  }

  /* ── 页面激活时调用（由 zuo.js 调用） ── */
  function onActivate() {
    // 如果还未初始化，进行初始化
    if (!initialized) {
      init();
    }
    // 恢复游戏状态（如果需要）
    Mode.Debug.log(CONFIG.debugTag, '游戏页面已激活');
  }

  /* ── 页面失活时调用（由 zuo.js 调用） ── */
  function onDeactivate() {
    stop();
  }

  Mode.ready(init);

  return { init, stop, onActivate, onDeactivate };
})();