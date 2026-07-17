// ============================================================
// youxi2.js — 反应训练游戏（游戏二）
// 功能: 亮灯点击测试反应速度，记录最快/平均反应时间
// 风格: 参考 awm.js 选项卡交互 + paodao.js 动态渲染
// [CREATED: 2026-06-11]
// ============================================================

const Game2 = (() => {
  'use strict';

  const CONFIG = { debugTag: 'Game2' };

  /* ── 状态 ── */
  let state = {
    mode: 'normal',  // normal | hard | hell
    round: 0,
    totalRounds: 10,
    results: [],
    phase: 'idle',  // idle | waiting | go | result
    waitTimer: null,
    reactionStart: 0,
    isRunning: false,
  };

  /* ── 模式配置 ── */
  const MODES = {
    normal: { waitMin: 1500, waitMax: 3500, label: '🟢 普通' },
    hard:   { waitMin: 800,  waitMax: 2000, label: '🔵 困难' },
    hell:   { waitMin: 400,  waitMax: 1200, label: '🔴 地狱' },
  };

  let initialized = false;
  let lightBox = null;
  let lightText = null;

  /* ── 渲染内容（替换 Game2 面板占位） ── */
  function renderContent() {
    var panel = document.getElementById('g1PanelGame2');
    if (!panel) { Mode.Debug.warn(CONFIG.debugTag, 'Game2 面板不存在'); return; }

    panel.innerHTML = '';
    var frag = document.createDocumentFragment();
    function APP(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); }

    APP('<div class="g2-mode-row">' +
      '<div class="g2-mode-btn active" data-mode="normal">🟢 普通</div>' +
      '<div class="g2-mode-btn" data-mode="hard">🔵 困难</div>' +
      '<div class="g2-mode-btn" data-mode="hell">🔴 地狱</div>' +
    '</div>');

    APP('<div class="g2-info">' +
      '<div class="g2-info-item"><div class="g2-info-label">🔄 轮次</div><div class="g2-info-value" id="g2Round">0/10</div></div>' +
      '<div class="g2-info-item"><div class="g2-info-label">⚡ 最快</div><div class="g2-info-value" id="g2Best">—</div></div>' +
      '<div class="g2-info-item"><div class="g2-info-label">📊 平均</div><div class="g2-info-value" id="g2Avg">—</div></div>' +
    '</div>');

    APP('<div class="g2-light-box ready" id="g2LightBox">' +
      '<div class="g2-light-text" id="g2LightText">🟢 准备就绪</div>' +
    '</div>');

    APP('<div class="g2-result" id="g2Result">' +
      '<div class="g2-result-title">📊 本轮成绩</div>' +
      '<div class="g2-result-stats" id="g2ResultStats"></div>' +
    '</div>');

    APP('<div class="g2-ctrl">' +
      '<button class="g2-ctrl-btn g2-btn-start" id="g2StartBtn">🎮 开始训练</button>' +
      '<button class="g2-ctrl-btn g2-btn-leaderboard" id="g2SubmitBtn">🏆 提交成绩</button>' +
    '</div>' +
    '<!-- 排行榜嵌入区 -->' +
    '<div class="g1-lb-section" id="g1LbSectionGame2">' +
      '<div class="g1-lb-header">🏆 实时排行榜 <span class="g1-lb-mode" id="lbMode_game2">💻 本地</span></div>' +
      '<div class="g1-lb-name-row">' +
        '<span class="g1-lb-name-label">👤 玩家</span>' +
        '<input class="g1-lb-name-input" id="lbNameInput_game2" type="text" placeholder="输入你的名字" maxlength="12">' +
      '</div>' +
      '<div class="g1-lb-list" id="lbList_game2"><div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无记录</div></div></div>' +
    '</div>');

    panel.appendChild(frag);
    initLeaderboard();
    Mode.Debug.log(CONFIG.debugTag, 'Game2 渲染完成 ✅');
  }

  /* ── 绑定事件 ── */
  function bindEvents() {
    // 模式选择
    document.querySelectorAll('.g2-mode-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (state.isRunning) return;
        document.querySelectorAll('.g2-mode-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        state.mode = this.dataset.mode;
        resetGame();
      });
    });

    // 开始按钮
    var startBtn = document.getElementById('g2StartBtn');
    if (startBtn) startBtn.addEventListener('click', function() {
      if (state.isRunning) {
        stopGame();
      } else {
        startGame();
      }
    });

    // 灯箱点击
    lightBox = document.getElementById('g2LightBox');
    if (lightBox) lightBox.addEventListener('click', function() {
      handleClick();
    });

    // 玩家名输入框
    var nameInput = document.getElementById('lbNameInput_game2');
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
    var submitBtn = document.getElementById('g2SubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitToLeaderboard);
  }

  /* ── 手动提交成绩到排行榜 ── */
  function submitToLeaderboard() {
    if (typeof PaiHangBang === 'undefined' || !PaiHangBang.submitScore) {
      alert('排行榜模块未加载！');
      return;
    }
    if (!state.results || state.results.length === 0) {
      alert('还没有反应数据！先玩几轮再提交吧。');
      return;
    }
    var best = Math.min.apply(null, state.results);
    var avg = (state.results.reduce(function(a,b) { return a+b; }, 0) / state.results.length).toFixed(0);
    PaiHangBang.submitScore('game2', best, {
      avg: avg,
      rounds: state.results.length,
      mode: state.mode === 'normal' ? '普通' : (state.mode === 'hard' ? '困难' : '地狱')
    });
  }

  /* ── 点击处理 ── */
  function handleClick() {
    if (!state.isRunning) return;

    if (state.phase === 'go') {
      // 正确反应！
      var reactionTime = Date.now() - state.reactionStart;
      state.results.push(reactionTime);
      state.round++;
      updateInfo();
      setLight('hit', '✅ ' + reactionTime + 'ms');
      state.phase = 'result';

      if (state.round >= state.totalRounds) {
        endGame();
      } else {
        setTimeout(function() { startRound(); }, 800);
      }
    } else if (state.phase === 'waiting') {
      // 抢跑！
      setLight('too-early', '⚠️ 别急！等待绿灯');
      state.phase = 'result';
      clearTimeout(state.waitTimer);
      setTimeout(function() { startRound(); }, 800);
    }
    // idle/result 状态点击无反应
  }

  /* ── 开始游戏 ── */
  function startGame() {
    state.isRunning = true;
    state.round = 0;
    state.results = [];
    document.getElementById('g2Result').style.display = 'none';

    var btn = document.getElementById('g2StartBtn');
    btn.textContent = '⏹ 结束训练';
    btn.className = 'g2-ctrl-btn g2-btn-stop';

    startRound();
  }

  /* ── 停止游戏 ── */
  function stopGame() {
    state.isRunning = false;
    clearTimeout(state.waitTimer);
    setLight('ready', '🟢 准备就绪');
    state.phase = 'idle';

    var btn = document.getElementById('g2StartBtn');
    btn.textContent = '🎮 开始训练';
    btn.className = 'g2-ctrl-btn g2-btn-start';
  }

  /* ── 结束游戏 ── */
  function endGame() {
    stopGame();
    document.getElementById('g2Round').textContent = state.totalRounds + '/' + state.totalRounds;
    showResult();
  }

  /* ── 开始一轮 ── */
  function startRound() {
    if (!state.isRunning) return;
    state.phase = 'waiting';
    setLight('waiting', '⏳ 等待绿灯...');
    updateInfo();

    var cfg = MODES[state.mode];
    var delay = cfg.waitMin + Math.random() * (cfg.waitMax - cfg.waitMin);

    state.waitTimer = setTimeout(function() {
      if (!state.isRunning) return;
      state.phase = 'go';
      state.reactionStart = Date.now();
      setLight('go', '🟢 点击！');
    }, delay);
  }

  /* ── 设置灯箱状态 ── */
  function setLight(stateClass, text) {
    if (!lightBox) lightBox = document.getElementById('g2LightBox');
    if (!lightText) lightText = document.getElementById('g2LightText');
    if (!lightBox || !lightText) return;

    lightBox.className = 'g2-light-box ' + stateClass;
    lightText.textContent = text;
  }

  /* ── 更新信息栏 ── */
  function updateInfo() {
    document.getElementById('g2Round').textContent = state.round + '/' + state.totalRounds;
    if (state.results.length > 0) {
      var best = Math.min.apply(null, state.results);
      var avg = (state.results.reduce(function(a,b) { return a+b; }, 0) / state.results.length).toFixed(0);
      document.getElementById('g2Best').textContent = best + 'ms';
      document.getElementById('g2Avg').textContent = avg + 'ms';
    }
  }

  /* ── 显示结果 ── */
  function showResult() {
    var resultDiv = document.getElementById('g2Result');
    var statsDiv = document.getElementById('g2ResultStats');
    if (!resultDiv || !statsDiv) return;

    var r = state.results;
    if (r.length === 0) {
      statsDiv.innerHTML = '<div style="text-align:center;color:#8ab4c8;">没有记录到有效数据</div>';
    } else {
      var best = Math.min.apply(null, r);
      var avg = (r.reduce(function(a,b) { return a+b; }, 0) / r.length).toFixed(0);
      var worst = Math.max.apply(null, r);

      statsDiv.innerHTML =
        '<div class="g2-stat-item"><span class="g2-stat-label">⚡ 最快反应</span><span class="g2-stat-value">' + best + 'ms</span></div>' +
        '<div class="g2-stat-item"><span class="g2-stat-label">📊 平均反应</span><span class="g2-stat-value">' + avg + 'ms</span></div>' +
        '<div class="g2-stat-item"><span class="g2-stat-label">🐢 最慢反应</span><span class="g2-stat-value">' + worst + 'ms</span></div>' +
        '<div class="g2-stat-item"><span class="g2-stat-label">🔄 有效次数</span><span class="g2-stat-value">' + r.length + ' 次</span></div>';
    }

    resultDiv.style.display = 'block';
  }

  /* ── 重置 ── */
  function resetGame() {
    state.round = 0;
    state.results = [];
    state.phase = 'idle';
    clearTimeout(state.waitTimer);
    document.getElementById('g2Round').textContent = '0/' + state.totalRounds;
    document.getElementById('g2Best').textContent = '—';
    document.getElementById('g2Avg').textContent = '—';
    document.getElementById('g2Result').style.display = 'none';
    setLight('ready', '🟢 准备就绪');
  }

  /* ── 初始化排行榜嵌入区 ── */
  function initLeaderboard() {
    if (typeof PaiHangBang === 'undefined') return;
    var listEl = document.getElementById('lbList_game2');
    if (listEl) PaiHangBang.renderRankList(listEl, 'game2');
  }

  /* ── 初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;
    renderContent();
    bindEvents();
    resetGame();
    Mode.Debug.log(CONFIG.debugTag, '反应训练游戏已就绪 ✅');
  }

  Mode.ready(init);

  return { init };
})();