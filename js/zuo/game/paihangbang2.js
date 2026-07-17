// ============================================================
// paihangbang.js — 牢区小游戏 · 实时排行榜
// 功能: 管理三个游戏的成绩记录、排行展示、数据持久化
// 依赖: mode.js (Mode 命名空间)
// [CREATED: 2026-06-11]
// ============================================================

const PaiHangBang = (() => {
  'use strict';

  const CONFIG = { debugTag: 'PaiHangBang' };
  const STORAGE_KEY = 'bqb_game_leaderboard';
  const MAX_RECORDS = 100;

  /* ── 游戏配置 ── */
  const GAMES = {
    game1: { id: 'game1', name: '🎯 气泡点击', scoreLabel: '命中数', unit: '个', sortAsc: false },
    game2: { id: 'game2', name: '⚡ 反应训练', scoreLabel: '最快反应', unit: 'ms', sortAsc: true },
    game3: { id: 'game3', name: '⛏️ 挂机挖宝', scoreLabel: '总金币', unit: '', sortAsc: false },
  };

  let initialized = false;
  let currentGameId = 'game1';

  /* ── 数据读写 ── */
  function getData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { playerName: '玩家', records: [] };
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '读取排行榜数据失败', e);
      return { playerName: '玩家', records: [] };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      Mode.Debug.error(CONFIG.debugTag, '保存排行榜数据失败', e);
    }
  }

  /* ── 玩家名称 ── */
  function getPlayerName() {
    return getData().playerName || '玩家';
  }

  function setPlayerName(name) {
    const data = getData();
    data.playerName = name.trim() || '玩家';
    saveData(data);
    Mode.Debug.log(CONFIG.debugTag, '玩家名称已更新:', data.playerName);
  }

  /* ── 提交成绩 ── */
  function submitScore(gameId, score, details) {
    const data = getData();
    const game = GAMES[gameId];
    if (!game) {
      Mode.Debug.warn(CONFIG.debugTag, '未知游戏 ID:', gameId);
      return false;
    }

    const record = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      gameId: gameId,
      gameName: game.name,
      playerName: data.playerName,
      score: score,
      details: details || {},
      timestamp: Date.now(),
    };

    data.records.push(record);

    // 按游戏分组排序
    Object.keys(GAMES).forEach(function(gid) {
      const cfg = GAMES[gid];
      const filtered = data.records.filter(function(r) { return r.gameId === gid; });
      filtered.sort(function(a, b) {
        return cfg.sortAsc ? a.score - b.score : b.score - a.score;
      });
      // 只保留前 MAX_RECORDS 条
      if (filtered.length > MAX_RECORDS) {
        const keepIds = {};
        filtered.slice(0, MAX_RECORDS).forEach(function(r) { keepIds[r.id] = true; });
        data.records = data.records.filter(function(r) {
          return r.gameId !== gid || keepIds[r.id];
        });
      }
    });

    saveData(data);

    // 显示提交成功提示
    showToast('✅ 成绩已提交到排行榜！');

    Mode.Debug.log(CONFIG.debugTag, '成绩已提交:', game.name, score, details);
    return true;
  }

  /* ── 获取某游戏排名列表 ── */
  function getRankings(gameId) {
    const data = getData();
    const game = GAMES[gameId];
    if (!game) return [];

    const filtered = data.records.filter(function(r) { return r.gameId === gameId; });
    filtered.sort(function(a, b) {
      return game.sortAsc ? a.score - b.score : b.score - a.score;
    });

    return filtered.slice(0, 20);
  }

  /* ── Toast 提示 ── */
  function showToast(msg) {
    var existing = document.querySelector('.g4-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'g4-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 1500);
  }

  /* ── 清空排行榜 ── */
  function clearRankings() {
    if (!confirm('确定要清空所有排行榜数据吗？')) return;
    saveData({ playerName: getPlayerName(), records: [] });
    renderContent();
    Mode.Debug.log(CONFIG.debugTag, '排行榜已清空');
  }

  /* ── 渲染排行榜内容 ── */
  function renderContent() {
    const panel = document.getElementById('g1PanelGame4');
    if (!panel) { Mode.Debug.warn(CONFIG.debugTag, '排行榜面板不存在'); return; }

    panel.innerHTML = '';

    var frag = document.createDocumentFragment();
    function APP(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); }

    /* 玩家名称输入 */
    APP('<div class="g4-name-row">' +
      '<span class="g4-name-label">👤 玩家名称</span>' +
      '<input class="g4-name-input" id="g4NameInput" type="text" placeholder="输入你的名字..." value="' + escapeHtml(getPlayerName()) + '" maxlength="12">' +
    '</div>');

    /* 游戏选择标签 */
    APP('<div class="g4-game-tabs" id="g4GameTabs"></div>');

    /* 排行榜列表 */
    APP('<div class="g4-rank-list-wrap" id="g4RankList">' +
      '<div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无数据，先去玩游戏吧！</div></div>' +
    '</div>');

    /* 操作按钮 */
    APP('<div class="g4-actions">' +
      '<button class="g4-action-btn g4-btn-clear" id="g4ClearBtn">🗑️ 清空数据</button>' +
    '</div>');

    panel.appendChild(frag);

    /* 渲染游戏标签 */
    var tabsContainer = document.getElementById('g4GameTabs');
    Object.keys(GAMES).forEach(function(gid) {
      var game = GAMES[gid];
      var tab = document.createElement('div');
      tab.className = 'g4-game-tab' + (gid === currentGameId ? ' active' : '');
      tab.dataset.game = gid;
      tab.textContent = game.name;
      tab.addEventListener('click', function() {
        currentGameId = this.dataset.game;
        document.querySelectorAll('.g4-game-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        renderRankList();
      });
      tabsContainer.appendChild(tab);
    });

    /* 绑定事件 */
    bindEvents();

    /* 渲染列表 */
    renderRankList();
    Mode.Debug.log(CONFIG.debugTag, '排行榜渲染完成 ✅');
  }

  /* ── 转义 HTML ── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── 渲染排名列表 ── */
  function renderRankList() {
    var listEl = document.getElementById('g4RankList');
    if (!listEl) return;

    // 尝试从云端加载（首次渲染时）
    if (!_cloudLoaded) {
      loadFromCloud().then(function() {
        renderRankList();
      });
    }

    var rankings = getRankings(currentGameId);
    var game = GAMES[currentGameId];

    if (rankings.length === 0) {
      listEl.innerHTML = '<div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无数据，先去玩游戏吧！</div></div>';
      return;
    }

    var html = '';
    rankings.forEach(function(r, idx) {
      var rank = idx + 1;
      var topClass = rank === 1 ? ' top-1' : (rank === 2 ? ' top-2' : (rank === 3 ? ' top-3' : ''));
      var medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : rank));

      // 详情文本
      var detail = formatDetail(currentGameId, r.details);

      // 分数显示
      var scoreDisplay = game.sortAsc
        ? r.score + game.unit
        : formatBigNumber(r.score);

      html += '<div class="g4-rank-item' + topClass + '">' +
        '<div class="g4-rank-num">' + medal + '</div>' +
        '<div class="g4-rank-info">' +
          '<div class="g4-rank-name">' + escapeHtml(r.playerName) + '</div>' +
          '<div class="g4-rank-detail">' + detail + '</div>' +
        '</div>' +
        '<div class="g4-rank-score">' + scoreDisplay + '</div>' +
      '</div>';
    });

    listEl.innerHTML = html;
  }

  /* ── 格式化详情 ── */
  function formatDetail(gameId, details) {
    if (!details) return '';
    switch (gameId) {
      case 'game1':
        return '准确率 ' + (details.accuracy || 0) + '% · ' + (details.difficulty || '简单');
      case 'game2':
        return '平均 ' + (details.avg || 0) + 'ms · 共 ' + (details.rounds || 0) + ' 轮';
      case 'game3':
        return '轮回 ' + (details.prestige || 0) + ' 次 · 倍率 x' + (details.multiplier || 1).toFixed(1);
      default:
        return '';
    }
  }

  /* ── 大数字格式化 ── */
  function formatBigNumber(val) {
    if (val >= 1e8) return (val / 1e8).toFixed(2) + 'Y';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return Math.floor(val).toString();
  }

  /* ── 绑定事件 ── */
  function bindEvents() {
    var nameInput = document.getElementById('g4NameInput');
    if (nameInput) {
      nameInput.addEventListener('change', function() {
        setPlayerName(this.value);
      });
      nameInput.addEventListener('blur', function() {
        setPlayerName(this.value);
      });
    }

    var clearBtn = document.getElementById('g4ClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearRankings);
    }
  }

  /* ── 对外暴露：提交成绩接口 ── */
  function apiSubmitScore(gameId, score, details) {
    return submitScore(gameId, score, details);
  }

  /* ── 初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;
    Mode.Debug.log(CONFIG.debugTag, '排行榜模块已就绪 ✅');
  }

  Mode.ready(init);

  return {
    init: init,
    submitScore: apiSubmitScore,
    getPlayerName: getPlayerName,
    renderContent: renderContent,
  };
})();
