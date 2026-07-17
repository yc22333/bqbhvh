// ============================================================
// youxi3.js — 挂机挖宝游戏（游戏三）
// 功能: 放置类挖宝游戏，含升级/自动采矿/工具升级/轮回系统
// 风格: 参考 awm.js 交互模式 + paodao.js 动态渲染
// [CREATED: 2026-06-11] [UPDATED: 2026-06-11]
// ============================================================

const Game3 = (() => {
  'use strict';

  const CONFIG = { debugTag: 'Game3' };
  const SAVE_KEY = 'bqb_game3_save';

  /* ── 保存游戏存档（带时间戳，同步到云端） ── */
  function saveState(silent) {
    try {
      const now = Date.now();
      const data = {
        gold: state.gold,
        totalGold: state.totalGold,
        clickPower: state.clickPower,
        goldPerSec: state.goldPerSec,
        prestigeCount: state.prestigeCount,
        prestigeMultiplier: state.prestigeMultiplier,
        autoMining: state.autoMining,
        upgrades: state.upgrades,
        clickCount: state.clickCount,
        manualGold: state.manualGold,
        autoGold: state.autoGold,
        critCount: state.critCount,
        critGold: state.critGold,
        equippedTitles: state.equippedTitles,
        maxClickPower: state.maxClickPower,
        maxGoldPerSec: state.maxGoldPerSec,
        maxPrestigeGold: state.maxPrestigeGold,
        savedAt: now,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      // 同步到云端
      if (typeof Mode !== 'undefined' && Mode.CloudData) {
        Mode.CloudData.saveGameSave('game3', data).then(function(ok) {
          if (ok && !silent) Mode.Debug.log(CONFIG.debugTag, '☁️ 存档已同步到云端');
        }).catch(function() {});
      }
      if (!silent) Mode.Debug.log(CONFIG.debugTag, '💾 存档已保存: 金币 ' + formatGold(state.gold));
      // 同步更新页面上的存档时间显示
      updateSaveInfo();
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '保存失败:', e.message);
      return false;
    }
  }

  /* ── 加载游戏存档（先本地，再尝试从云端同步） ── */
  function loadState() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (!saved) return false;

      state.gold = saved.gold || 0;
      state.totalGold = saved.totalGold || 0;
      state.clickPower = saved.clickPower || 1;
      state.goldPerSec = saved.goldPerSec || 0;
      state.prestigeCount = saved.prestigeCount || 0;
      state.prestigeMultiplier = saved.prestigeMultiplier || 1;
      state.autoMining = saved.autoMining !== undefined ? saved.autoMining : true;
      state.upgrades = saved.upgrades || {};

      // 累计统计
      state.clickCount = saved.clickCount || 0;
      state.manualGold = saved.manualGold || 0;
      state.autoGold = saved.autoGold || 0;
      state.critCount = saved.critCount || 0;
      state.critGold = saved.critGold || 0;

      // 最高统计（历史峰值）
      state.maxClickPower = saved.maxClickPower || 0;
      state.maxGoldPerSec = saved.maxGoldPerSec || 0;
      state.maxPrestigeGold = saved.maxPrestigeGold || 0;

      // 成就穿戴
      state.equippedTitles = saved.equippedTitles || {};

      // 防御性：如果有异常值（NaN/Infinity），重置为安全值
      if (!isFinite(state.gold) || state.gold < 0) state.gold = 0;
      if (!isFinite(state.totalGold) || state.totalGold < 0) state.totalGold = 0;
      if (!isFinite(state.clickPower) || state.clickPower < 1) state.clickPower = 1;
      if (!isFinite(state.goldPerSec) || state.goldPerSec < 0) state.goldPerSec = 0;

      // 离线收益计算（离线期间每秒收益 × 时间）- 静默收取，不显示弹窗
      if (saved.savedAt && saved.savedAt > 0 && state.autoMining && state.goldPerSec > 0) {
        var offlineSec = Math.floor((Date.now() - saved.savedAt) / 1000);
        // 最多计算 24 小时离线收益
        offlineSec = Math.min(offlineSec, 24 * 3600);
        if (offlineSec > 10) {
          var offlineGain = state.goldPerSec * offlineSec * 0.5;  // 离线效率 50%
          state.gold += offlineGain;
          state.totalGold += offlineGain;
          state.autoGold += offlineGain;
          Mode.Debug.log(CONFIG.debugTag, '🕒 离线 ' + offlineSec + 's，收益 +' + formatGold(offlineGain));
          // 静默收取，不显示弹窗
        }
      }

      Mode.Debug.log(CONFIG.debugTag, '✅ 存档已加载: 金币 ' + formatGold(state.gold));
      return true;
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '加载失败:', e.message);
      return false;
    }
  }

  /* ── 离线收益提示弹窗 ── */
  function showOfflineReward(seconds, gain) {
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds % 3600) / 60);
    var timeStr = hours > 0 ? (hours + ' 小时 ' + mins + ' 分') : (mins + ' 分钟');
    var overlay = document.createElement('div');
    overlay.className = 'g3-offline-overlay';
    overlay.innerHTML = 
      '<div class="g3-offline-box">' +
        '<div class="g3-offline-title">🕒 欢迎回来！</div>' +
        '<div class="g3-offline-time">你离开了 ' + timeStr + '</div>' +
        '<div class="g3-offline-gain">离线期间矿工为你挖了: <span class="g3-gain-num">+' + formatGold(gain) + '</span> 金币</div>' +
        '<div class="g3-offline-hint">点击任意位置关闭</div>' +
      '</div>';
    document.body.appendChild(overlay);
    
    // 点击任意位置关闭弹窗（金币已自动添加）
    overlay.addEventListener('click', function(e) {
      // 阻止事件冒泡，确保点击弹窗内部也能关闭
      e.stopPropagation();
      overlay.remove();
    });
    
    // 8秒后自动关闭
    setTimeout(function() { 
      if (overlay.parentNode) overlay.remove(); 
    }, 8000);
  }

  /* ── 手动保存并提示 ── */
  function manualSave() {
    var ok = saveState(false);
    if (ok) showToast('💾 存档已保存！');
    else showToast('❌ 保存失败');
  }

  /* ── 手动加载（从存档恢复，覆盖当前进度） ── */
  function manualLoad() {
    if (!confirm('确定从存档恢复吗？当前未保存的进度将丢失！')) return;
    var ok = loadState();
    if (ok) {
      recalcStats();
      renderContent();
      bindEvents();
      updateDisplay();
      showToast('✅ 存档已恢复！');
    } else {
      showToast('⚠️ 没有可用存档');
    }
  }

  /* ── 导出存档（生成可复制的字符串） ── */
  function exportSave() {
    try {
      const data = {
        gold: state.gold,
        totalGold: state.totalGold,
        clickPower: state.clickPower,
        goldPerSec: state.goldPerSec,
        prestigeCount: state.prestigeCount,
        prestigeMultiplier: state.prestigeMultiplier,
        autoMining: state.autoMining,
        upgrades: state.upgrades,
        clickCount: state.clickCount,
        manualGold: state.manualGold,
        autoGold: state.autoGold,
        critCount: state.critCount,
        critGold: state.critGold,
        maxClickPower: state.maxClickPower,
        maxGoldPerSec: state.maxGoldPerSec,
        maxPrestigeGold: state.maxPrestigeGold,
        equippedTitles: state.equippedTitles,
        savedAt: Date.now(),
      };
      var str = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      var overlay = document.createElement('div');
      overlay.className = 'g3-offline-overlay';
      overlay.innerHTML = 
        '<div class="g3-offline-box">' +
          '<div class="g3-offline-title">📤 导出存档</div>' +
          '<div class="g3-offline-time">复制下方代码到其他设备/浏览器即可继续游戏</div>' +
          '<textarea class="g3-export-text" readonly>' + str + '</textarea>' +
          '<button class="g3-offline-close" id="g3CopyBtn">📋 复制代码</button>' +
          '<button class="g3-offline-close" id="g3CloseExport">关闭</button>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#g3CopyBtn').addEventListener('click', function() {
        var ta = overlay.querySelector('.g3-export-text');
        ta.select();
        try {
          document.execCommand('copy');
          showToast('✅ 存档代码已复制！');
        } catch(e) {
          showToast('⚠️ 请手动选中复制');
        }
      });
      overlay.querySelector('#g3CloseExport').addEventListener('click', function() { overlay.remove(); });
    } catch (e) {
      showToast('❌ 导出失败');
    }
  }

  /* ── 导入存档（粘贴代码恢复游戏） ── */
  function importSave() {
    var code = prompt('请粘贴存档代码:');
    if (!code || !code.trim()) return;
    try {
      var decoded = decodeURIComponent(escape(atob(code.trim())));
      var saved = JSON.parse(decoded);
      if (!saved) throw new Error('无效数据');
      state.gold = saved.gold || 0;
      state.totalGold = saved.totalGold || 0;
      state.clickPower = saved.clickPower || 1;
      state.goldPerSec = saved.goldPerSec || 0;
      state.prestigeCount = saved.prestigeCount || 0;
      state.prestigeMultiplier = saved.prestigeMultiplier || 1;
      state.autoMining = saved.autoMining !== undefined ? saved.autoMining : true;
      state.upgrades = saved.upgrades || {};
      state.clickCount = saved.clickCount || 0;
      state.manualGold = saved.manualGold || 0;
      state.autoGold = saved.autoGold || 0;
      state.critCount = saved.critCount || 0;
      state.critGold = saved.critGold || 0;
      state.equippedTitles = saved.equippedTitles || {};
      state.maxClickPower = saved.maxClickPower || 0;
      state.maxGoldPerSec = saved.maxGoldPerSec || 0;
      state.maxPrestigeGold = saved.maxPrestigeGold || 0;
      saveState(true);
      recalcStats();
      renderContent();
      bindEvents();
      updateDisplay();
      showToast('✅ 存档导入成功！');
    } catch (e) {
      showToast('❌ 存档代码无效');
    }
  }

  /* ── 清除本地存档（重置专用） ── */
  function clearLocalSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }

  /* ── Toast 提示（复用 paihangbang 风格） ── */
  function showToast(msg) {
    var existing = document.querySelector('.g3-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'g3-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('show'); });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 1800);
  }

  /* ── 更新页面上的存档信息（时间戳 + 状态） ── */
  function updateSaveInfo() {
    var infoEl = document.getElementById('g3SaveInfo');
    if (!infoEl) return;
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        infoEl.textContent = '💾 暂无存档';
        return;
      }
      var saved = JSON.parse(raw);
      if (saved && saved.savedAt) {
        var date = new Date(saved.savedAt);
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        var timeStr = pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
        infoEl.textContent = '💾 上次保存: ' + timeStr + ' | 金币: ' + formatGold(saved.gold || 0);
      } else {
        infoEl.textContent = '💾 已有存档';
      }
    } catch (e) {
      infoEl.textContent = '💾 存档状态: 未知';
    }
  }

  /* ── 状态 ── */
  let state = {
    gold: 0,
    totalGold: 0,
    clickPower: 1,
    goldPerSec: 0,
    prestigeCount: 0,
    prestigeMultiplier: 1,
    autoMining: true,
    upgrades: {},
    // 累计统计
    clickCount: 0,
    manualGold: 0,
    autoGold: 0,
    critCount: 0,
    critGold: 0,
    // 最高统计（历史峰值）
    maxClickPower: 0,
    maxGoldPerSec: 0,
    maxPrestigeGold: 0,
    // 成就：{ id: 穿戴次数 }
    equippedTitles: {},
    // 已解锁的成就（永久保留，除非重置）
    unlockedAchievements: [],
  };

  /* ── 成就解锁状态持久化存储键 ── */
  const ACHIEVEMENTS_KEY = 'bqb_game3_achievements';

  /* ── 工具图标列表（根据工具升级等级变化，从低到高共7级） ── */
  const TOOL_ICONS = [
    { name: '木镐',     img: 'photo/youxi/gaozi/mugao.png' },
    { name: '石镐',     img: 'photo/youxi/gaozi/shigao.png' },
    { name: '铜镐',     img: 'photo/youxi/gaozi/tonggao.png' },
    { name: '铁镐',     img: 'photo/youxi/gaozi/tiegao.png' },
    { name: '金镐',     img: 'photo/youxi/gaozi/jingao.png' },
    { name: '钻石镐',   img: 'photo/youxi/gaozi/zuanshigao.png' },
    { name: '下界镐',   img: 'photo/youxi/gaozi/xiajieshiyinggao.png' },
  ];

  function getToolIcon(lv) {
    var idx = Math.min(lv, TOOL_ICONS.length - 1);
    var t = TOOL_ICONS[idx];
    return '<img src="' + t.img + '" class="g3-tool-pickaxe">';
  }

  function getToolName(lv) {
    var idx = Math.min(lv, TOOL_ICONS.length - 1);
    return TOOL_ICONS[idx].name;
  }

  /* ── 成就定义：解锁后可穿戴获得全局倍率，可重复穿戴堆叠加成 ── */
  const ACHIEVEMENTS = [
    { id: 'click_100',   name: '⛏️ 初出茅庐', desc: '累计点击 100 次',         bonus: 0.1, check: function(s) { return s.clickCount >= 100; } },
    { id: 'click_1000',  name: '⛏️ 挖矿狂人', desc: '累计点击 1,000 次',        bonus: 0.3, check: function(s) { return s.clickCount >= 1000; } },
    { id: 'click_10000', name: '⛏️ 镐下有神', desc: '累计点击 10,000 次',       bonus: 1.0, check: function(s) { return s.clickCount >= 10000; } },
    { id: 'gold_10k',    name: '💰 小富即安', desc: '累计获得 1万 金币',         bonus: 0.2, check: function(s) { return s.totalGold >= 10000; } },
    { id: 'gold_100k',   name: '💰 富甲一方', desc: '累计获得 10万 金币',        bonus: 0.5, check: function(s) { return s.totalGold >= 100000; } },
    { id: 'gold_1m',     name: '💰 万贯家财', desc: '累计获得 100万 金币',       bonus: 1.5, check: function(s) { return s.totalGold >= 1000000; } },
    { id: 'auto_10k',    name: '🤖 自动新手', desc: '自动采矿累计 1万 金币',      bonus: 0.2, check: function(s) { return s.autoGold >= 10000; } },
    { id: 'auto_100k',   name: '🤖 自动达人', desc: '自动采矿累计 10万 金币',     bonus: 0.5, check: function(s) { return s.autoGold >= 100000; } },
    { id: 'manual_10k',  name: '👆 勤劳致富', desc: '手动挖宝累计 1万 金币',      bonus: 0.15, check: function(s) { return s.manualGold >= 10000; } },
    { id: 'manual_100k', name: '👆 手动大师', desc: '手动挖宝累计 10万 金币',     bonus: 0.5, check: function(s) { return s.manualGold >= 100000; } },
    { id: 'crit_100',    name: '💥 暴击新人', desc: '触发 100 次暴击',           bonus: 0.15, check: function(s) { return s.critCount >= 100; } },
    { id: 'crit_1000',   name: '💥 暴击之王', desc: '触发 1,000 次暴击',         bonus: 0.8, check: function(s) { return s.critCount >= 1000; } },
    { id: 'crit_100k',   name: '💥 暴击致富', desc: '暴击累计获得 10万 金币',     bonus: 0.6, check: function(s) { return s.critGold >= 100000; } },
    { id: 'prestige_5',  name: '🔄 轮回行者', desc: '累计轮回 5 次',            bonus: 0.3, check: function(s) { return s.prestigeCount >= 5; } },
    { id: 'prestige_20', name: '🔄 轮回大师', desc: '累计轮回 20 次',           bonus: 1.0, check: function(s) { return s.prestigeCount >= 20; } },
    { id: 'god_click',   name: '🌟 镐破苍穹', desc: '挖宝之力达 1e6',         bonus: 5.0, check: function(s) { return s.clickCount >= 1000000; } },
    { id: 'god_gold',    name: '🌟 富可敌国', desc: '累计获得 1e12 金币',      bonus: 10.0, check: function(s) { return s.totalGold >= 1e12; } },
    { id: 'god_ultimate', name: '🌌 终极挖矿之神', desc: '三项全满足',               bonus: 20.0, check: function(s) { return s.clickCount >= 1000000 && s.totalGold >= 1e12 && s.prestigeCount >= 100; } },
    { id: 'god_prestige', name: '🔄 轮回神话', desc: '累计轮回 500 次',          bonus: 30.0, check: function(s) { return s.prestigeCount >= 500; } },
    { id: 'god_legend',   name: '👑 传说之神', desc: '点击1e7 + 金币1e15 + 轮回500', bonus: 50.0, check: function(s) { return s.clickCount >= 10000000 && s.totalGold >= 1e15 && s.prestigeCount >= 500; } },
  ];

  /* ── 加载成就解锁状态（持久化存储） ── */
  function loadAchievements() {
    try {
      var raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (raw) {
        state.unlockedAchievements = JSON.parse(raw);
        Mode.Debug.log(CONFIG.debugTag, '✅ 成就解锁状态已加载: ' + state.unlockedAchievements.length + ' 个');
      } else {
        state.unlockedAchievements = [];
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '加载成就状态失败:', e.message);
      state.unlockedAchievements = [];
    }
  }

  /* ── 保存成就解锁状态（持久化存储 + 云端同步） ── */
  function saveAchievements() {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(state.unlockedAchievements));
      Mode.Debug.log(CONFIG.debugTag, '✅ 成就解锁状态已保存');
      
      // 尝试同步到云端（静默失败）
      syncAchievementsToCloud();
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '保存成就状态失败:', e.message);
    }
  }

  /* ── 同步成就状态到云端 ── */
  async function syncAchievementsToCloud() {
    try {
      if (typeof PaiHangBang !== 'undefined' && PaiHangBang.submitScore) {
        // 通过提交成绩的方式，将成就状态附加到 details 中
        var details = {
          achievements: state.unlockedAchievements,
          clickCount: state.clickCount,
          totalGold: state.totalGold,
          prestigeCount: state.prestigeCount,
          autoGold: state.autoGold,
          manualGold: state.manualGold,
          critCount: state.critCount,
          critGold: state.critGold,
        };
        await PaiHangBang.submitScore('game3', state.totalGold, details);
        Mode.Debug.log(CONFIG.debugTag, '✅ 成就状态已同步到云端');
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '云端同步失败（静默）:', e.message);
    }
  }

  /* ── 从云端恢复成就状态 ── */
  async function restoreAchievementsFromCloud() {
    try {
      if (typeof PaiHangBang !== 'undefined' && PaiHangBang.getRankings) {
        // 获取排行榜数据
        var records = PaiHangBang.getRankings('game3');
        if (records && records.length > 0) {
          // 查找当前玩家的最新记录
          var playerName = localStorage.getItem('bqb_leaderboard_name') || '玩家';
          var playerRecords = records.filter(function(r) {
            return r.player_name === playerName;
          });
          
          if (playerRecords.length > 0) {
            // 按时间排序，取最新的记录
            playerRecords.sort(function(a, b) {
              var timeA = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : (b.created_at || 0);
              var timeB = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : (a.created_at || 0);
              return timeA - timeB;
            });
            var latest = playerRecords[0];
            if (latest.details && latest.details.achievements) {
              // 合并云端成就和本地成就（取并集）
              var cloudAchievements = latest.details.achievements;
              cloudAchievements.forEach(function(achId) {
                if (state.unlockedAchievements.indexOf(achId) < 0) {
                  state.unlockedAchievements.push(achId);
                }
              });
              saveAchievements();
              Mode.Debug.log(CONFIG.debugTag, '✅ 从云端恢复了 ' + cloudAchievements.length + ' 个成就');
              return true;
            }
          }
        }
      }
    } catch (e) {
      Mode.Debug.warn(CONFIG.debugTag, '从云端恢复成就失败:', e.message);
    }
    return false;
  }

  /* ── 检查是否解锁某个成就（检查持久化存储） ── */
  function isAchievementUnlocked(id) {
    if (state.unlockedAchievements.indexOf(id) >= 0) {
      return true;
    }
    var ach = ACHIEVEMENTS.find(function(a) { return a.id === id; });
    if (ach && ach.check(state)) {
      // 自动解锁并保存
      state.unlockedAchievements.push(id);
      saveAchievements();
      return true;
    }
    return false;
  }

  /* ── 检查并更新所有成就状态 ── */
  function checkAllAchievements() {
    var hasNew = false;
    ACHIEVEMENTS.forEach(function(a) {
      if (!isAchievementUnlocked(a.id) && a.check(state)) {
        state.unlockedAchievements.push(a.id);
        hasNew = true;
      }
    });
    if (hasNew) {
      saveAchievements();
      Mode.Debug.log(CONFIG.debugTag, '🎉 新成就解锁: ' + state.unlockedAchievements.length + ' 个');
    }
  }

  /* ── 穿戴/移除成就称号（点击切换开关状态） ── */
  function toggleTitle(id) {
    if (!isAchievementUnlocked(id)) return;
    if (state.equippedTitles[id]) {
      // 已穿戴，取消穿戴
      delete state.equippedTitles[id];
    } else {
      // 未穿戴，穿戴1次
      state.equippedTitles[id] = 1;
    }
    recalcStats();
    renderContent();
    bindEvents();
    updateDisplay();
  }

  /* ── 减少一个称号的穿戴次数 ── */
  function reduceTitle(id) {
    if (!state.equippedTitles[id] || state.equippedTitles[id] <= 0) return;
    state.equippedTitles[id]--;
    if (state.equippedTitles[id] <= 0) delete state.equippedTitles[id];
    recalcStats();
    renderContent();
    bindEvents();
    updateDisplay();
  }
  /* ── 升级定义（无等级上限） ── */
  const UPGRADES = [
    { id: 'click', name: '⛏️ 挖宝之力',  baseCost: 10,  costMult: 1.5, effect: function(lv) { return 1 + lv; },                      desc: function(lv) { return '+' + formatSci(1 + lv) + '/点击'; } },
    { id: 'auto1', name: '⚡ 自动挖宝速率', baseCost: 25, costMult: 1.8, effect: function(lv) { return 1 + lv * 0.5; },             desc: function(lv) { return (1 + lv * 0.5).toFixed(1) + '次/秒'; } },
    { id: 'auto2', name: '🔧 镐子升级',  baseCost: 50,  costMult: 2.0, effect: function(lv) { return 1 + lv * 0.5; },                desc: function(lv) { return getToolName(lv) + ' x' + (1 + lv * 0.5).toFixed(1) + ' 全局'; } },
    { id: 'crit',  name: '💥 暴击强化',  baseCost: 40,  costMult: 1.6, effect: function(lv) { return Math.min(0.05 + lv * 0.05, 1); }, desc: function(lv) {
        var critPct = Math.min((0.05 + lv * 0.05) * 100, 100);
        var dmgMult = 1 + lv * 0.5;
        var extraLv = Math.max(lv - 19, 0);
        if (extraLv > 0) {
          return '暴击率 ' + critPct.toFixed(0) + '% | 暴伤 x' + dmgMult.toFixed(1) + ' | 全局 x' + (1 + extraLv * 0.5).toFixed(1);
        }
        return '暴击率 ' + critPct.toFixed(0) + '% | 暴伤 x' + dmgMult.toFixed(1);
      } },
  ];

  let initialized = false;
  let autoTimer = null;
  let saveTimer = null;
  let infoTimer = null;

  /* ── 初始化升级等级 ── */
  function initUpgrades() {
    UPGRADES.forEach(function(u) {
      state.upgrades[u.id] = 0;
    });
  }

  /* ── 渲染内容 ── */
  function renderContent() {
    var panel = document.getElementById('g1PanelGame3');
    if (!panel) { Mode.Debug.warn(CONFIG.debugTag, 'Game3 面板不存在'); return; }

    panel.innerHTML = '';
    var frag = document.createDocumentFragment();
    function APP(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); }

    var toolLv = state.upgrades.auto2 || 0;
    var toolIcon = getToolIcon(toolLv);
    var toolName = getToolName(toolLv);

    APP('<div class="g3-stats">' +
      '<div class="g3-stat-box"><div class="g3-stat-label">💰 金币</div><div class="g3-stat-value g3-gold-value" id="g3Gold">0</div></div>' +
      '<div class="g3-stat-box"><div class="g3-stat-label">⛏️ 挖宝之力</div><div class="g3-stat-value" id="g3ClickPower">1</div></div>' +
      '<div class="g3-stat-box"><div class="g3-stat-label">⏱ 每秒收益</div><div class="g3-stat-value" id="g3GPS">0</div></div>' +
    '</div>');

    APP('<div class="g3-click-zone" id="g3ClickZone">' +
      '<div class="g3-click-icon" id="g3ToolIcon">' + toolIcon + '</div>' +
    '</div>');

    APP('<div class="g3-tool-name" id="g3ToolName">⚡ 当前工具：' + toolName + '</div>');

    var toggleStatus = state.autoMining ? '🟢 已开启' : '🔴 已关闭';
    var toggleClass = state.autoMining ? 'g3-auto-on' : 'g3-auto-off';
    APP('<div class="g3-auto-row">' +
      '<span class="g3-auto-label">🤖 自动采矿</span>' +
      '<button class="g3-auto-toggle ' + toggleClass + '" id="g3AutoToggle">' + toggleStatus + '</button>' +
    '</div>');

    APP('<div class="g3-idle-notice">💡 点击挖宝，购买升级提升收益</div>');

    APP('<div class="g3-shop-title">🏪 升级商店</div>');
    APP('<div class="g3-shop-grid" id="g3ShopGrid"></div>');

    
    // ── 详细统计面板 ──
    APP('<div class="g3-stats-detail">' +
      '<div class="g3-shop-title">📊 游戏统计</div>' +
      '<div class="g3-stat-grid">' +
        '<div class="g3-stat-box"><div class="g3-stat-label">🖱️ 总点击次数</div><div class="g3-stat-value" id="g3ClickCount">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">👆 手动累计</div><div class="g3-stat-value" id="g3ManualGold">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">🤖 自动累计</div><div class="g3-stat-value" id="g3AutoGold">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">💰 累计金币</div><div class="g3-stat-value" id="g3TotalGold">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">💥 暴击次数</div><div class="g3-stat-value" id="g3CritCount">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">💥 暴击累计</div><div class="g3-stat-value" id="g3CritGold">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">🏆 最高自动速度</div><div class="g3-stat-value g3-highlight" id="g3AutoSpeed">1.0/秒</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">✨ 当前全局倍率</div><div class="g3-stat-value g3-highlight" id="g3GlobalMult">x1.0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">🏆 称号加成</div><div class="g3-stat-value g3-highlight" id="g3TitleBonus">+0%</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">📈 最高挖宝之力</div><div class="g3-stat-value g3-highlight" id="g3MaxClickPower">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">📈 最高每秒收益</div><div class="g3-stat-value g3-highlight" id="g3MaxGoldPerSec">0</div></div>' +
        '<div class="g3-stat-box"><div class="g3-stat-label">📈 轮回次数</div><div class="g3-stat-value g3-highlight" id="g3MaxPrestigeGold">0</div></div>' +
      '</div>' +
    '</div>');

    // ── 成就称号面板 ──
    APP('<div class="g3-achievement-panel">' +
      '<div class="g3-shop-title">🏆 成就称号（点击切换穿戴，右键减一次）</div>' +
      '<div class="g3-shop-grid g3-ach-grid" id="g3AchGrid"></div>' +
    '</div>');
APP('<div class="g3-save-info" id="g3SaveInfo">💾 正在初始化...</div>');

    APP('<div class="g3-save-bar">' +
      '<button class="g3-save-btn" id="g3SaveBtn" title="立即保存">💾 保存</button>' +
      '<button class="g3-save-btn" id="g3LoadBtn" title="从存档恢复">📂 加载</button>' +
      '<button class="g3-save-btn" id="g3ExportBtn" title="导出存档代码">📤 导出</button>' +
      '<button class="g3-save-btn" id="g3ImportBtn" title="导入存档代码">📥 导入</button>' +
    '</div>');

    APP('<div class="g1-ctrl">' +
      '<button class="g3-ctrl-btn g3-btn-prestige" id="g3PrestigeBtn">🔄 轮回转生</button>' +
      '<button class="g3-ctrl-btn g3-btn-reset" id="g3ResetBtn">🗑️ 重置</button>' +
      '<button class="g3-ctrl-btn g3-btn-leaderboard" id="g3LeaderboardBtn">🏆 提交成绩</button>' +
    '</div>' +
    '<!-- 排行榜嵌入区 -->' +
    '<div class="g1-lb-section" id="g1LbSectionGame3">' +
      '<div class="g1-lb-header">🏆 实时排行榜 <span class="g1-lb-mode" id="lbMode_game3">💻 本地</span></div>' +
      '<div class="g1-lb-name-row">' +
        '<span class="g1-lb-name-label">👤 玩家</span>' +
        '<input class="g1-lb-name-input" id="lbNameInput_game3" type="text" placeholder="输入你的名字" maxlength="12">' +
      '</div>' +
      '<div class="g1-lb-list" id="lbList_game3"><div class="g4-empty"><div class="g4-empty-icon">🏆</div><div>暂无记录</div></div></div>' +
    '</div>');

    panel.appendChild(frag);
    initLeaderboard();
    renderShop();
    renderAchievements();
    updateDisplay();
    Mode.Debug.log(CONFIG.debugTag, 'Game3 渲染完成 ✅');
  }

  /* ── 渲染商店 ── */
  function renderShop() {
    var grid = document.getElementById('g3ShopGrid');
    if (!grid) return;
    grid.innerHTML = '';

    UPGRADES.forEach(function(u) {
      var lv = state.upgrades[u.id] || 0;
      var cost = Math.floor(u.baseCost * Math.pow(u.costMult, lv));
      var canAfford = state.gold >= cost;

      var div = document.createElement('div');
      div.className = 'g3-shop-item' + (canAfford ? ' can-afford' : '');
      div.dataset.id = u.id;

      var nameText = u.name;
      if (u.id === 'auto2') {
        nameText = '<img src="' + TOOL_ICONS[Math.min(lv, TOOL_ICONS.length - 1)].img + '" class="g3-shop-pickaxe"> ' + getToolName(lv);
      }

      div.innerHTML =
        '<div class="g3-shop-name">' + nameText + '</div>' +
        '<div class="g3-shop-lv">等级 ' + lv + '</div>' +
        '<div class="g3-shop-cost">💰 ' + formatGold(cost) + '</div>' +
        '<div class="g3-shop-effect">' + u.desc(lv) + '</div>';

      div.addEventListener('click', function() {
        buyUpgrade(u.id);
      });

      grid.appendChild(div);
    });
  }

  
  /* ── 渲染成就称号面板 ── */
  function renderAchievements() {
    var grid = document.getElementById('g3AchGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ACHIEVEMENTS.forEach(function(a) {
      var unlocked = isAchievementUnlocked(a.id);
      var equipped = state.equippedTitles[a.id] || 0;

      var div = document.createElement('div');
      div.className = 'g3-shop-item' + (unlocked ? ' can-afford' : ' g3-locked') + (equipped > 0 ? ' g3-equipped' : '');
      div.dataset.id = a.id;

      var bonusText = '+' + (a.bonus * 100).toFixed(0) + '% 全局';

      div.innerHTML =
        '<div class="g3-shop-name">' + a.name + '</div>' +
        '<div class="g3-shop-lv">' + (unlocked ? ('✅ 已解锁' + (equipped > 0 ? ' · 穿戴 x' + equipped : '')) : '🔒 未解锁') + '</div>' +
        '<div class="g3-shop-cost">' + (unlocked ? bonusText : bonusText) + '</div>' +
        '<div class="g3-shop-effect">' + a.desc + '</div>';

      if (unlocked) {
        div.addEventListener('click', function() { toggleTitle(a.id); });
        div.addEventListener('contextmenu', function(e) { e.preventDefault(); reduceTitle(a.id); });
      }

      grid.appendChild(div);
    });
  }
/* ── 购买升级 ── */
  function buyUpgrade(id) {
    var u = UPGRADES.find(function(x) { return x.id === id; });
    if (!u) return;
    var lv = state.upgrades[id] || 0;
    var cost = Math.floor(u.baseCost * Math.pow(u.costMult, lv));
    if (state.gold < cost) return;

    state.gold -= cost;
    state.upgrades[id]++;
    var newLv = state.upgrades[id];

    // 工具升级时，更新点击区域图标和工具名
    if (id === 'auto2') {
      var iconEl = document.getElementById('g3ToolIcon');
      var nameEl = document.getElementById('g3ToolName');
      if (iconEl) iconEl.innerHTML = getToolIcon(newLv);
      if (nameEl) nameEl.innerHTML = '⚡ 当前工具：' + getToolName(newLv);
    }

    recalcStats();
    renderShop();
    renderAchievements();
    updateDisplay();
  }

  /* ── 重新计算统计 ── */
  function recalcStats() {
    var clickLv = state.upgrades.click || 0;
    var auto1Lv = state.upgrades.auto1 || 0;
    var auto2Lv = state.upgrades.auto2 || 0;
    var critLv = state.upgrades.crit || 0;

    // 基础挖宝之力（每次点击收益基数）
    var baseClick = 1 + clickLv;

    // 自动挖宝速度：每秒自动点击次数
    var autoSpeed = 1 + auto1Lv * 0.5;

    // 镐子升级：全局倍率
    var pickaxeMult = 1 + auto2Lv * 0.5;

    // 暴击强化：超过 19 级时（暴击率 100%）多余等级转为全局倍率
    var extraCritLv = Math.max(critLv - 19, 0);
    var critGlobalMult = 1 + extraCritLv * 0.5;

    // 成就称号：总加成倍率
    var titleBonus = getTitleMultiplier();
    var titleMult = 1 + titleBonus;

    // 综合全局倍率（不包含轮回倍率，用于显示）
    var globalMult = pickaxeMult * critGlobalMult * titleMult;

    // 每次点击收益 = 基础 × 全局倍率 × 轮回倍率
    state.clickPower = baseClick * globalMult * state.prestigeMultiplier;

    // 每秒收益 = 自动挖宝速度 × 每次点击收益
    if (state.autoMining) {
      state.goldPerSec = autoSpeed * state.clickPower;
    } else {
      state.goldPerSec = 0;
    }

    // 更新历史最高统计
    if (state.clickPower > state.maxClickPower) state.maxClickPower = state.clickPower;
    if (state.goldPerSec > state.maxGoldPerSec) state.maxGoldPerSec = state.goldPerSec;
  }

  function getTitleMultiplier() {
    var bonus = 0;
    for (var id in state.equippedTitles) {
      if (!state.equippedTitles.hasOwnProperty(id)) continue;
      var count = state.equippedTitles[id] || 0;
      if (count <= 0) continue;
      var ach = ACHIEVEMENTS.find(function(a) { return a.id === id; });
      if (ach) bonus += count * ach.bonus;
    }
    return bonus;
  }

  /* ── 切换自动采矿 ── */
  function toggleAutoMining() {
    state.autoMining = !state.autoMining;
    var btn = document.getElementById('g3AutoToggle');
    if (btn) {
      btn.textContent = state.autoMining ? '🟢 已开启' : '🔴 已关闭';
      btn.className = 'g3-auto-toggle ' + (state.autoMining ? 'g3-auto-on' : 'g3-auto-off');
    }
    recalcStats();
    updateDisplay();
  }

  /* ── 点击挖宝 ── */
  function handleClick(e) {
    var zone = document.getElementById('g3ClickZone');
    if (!zone) return;

    var critLv = state.upgrades.crit || 0;
    var critRate = Math.min(0.05 + critLv * 0.05, 1);
    var critMult = 1 + critLv * 0.5;
    var isCrit = Math.random() < critRate;
    var gain = state.clickPower * (isCrit ? critMult : 1);

    state.gold += gain;
    state.totalGold += gain;
    state.clickCount++;
    state.manualGold += gain;
    if (isCrit) {
      state.critCount++;
      state.critGold += gain;
    }

    updateDisplay();

    // 飘字特效
    var rect = zone.getBoundingClientRect();
    var x, y;
    if (e.clientX !== undefined) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = rect.width / 2;
      y = rect.height / 2;
    }

    var floatText = document.createElement('div');
    floatText.className = 'g3-float-text';
    floatText.textContent = (isCrit ? '💥 ' : '+') + formatGold(gain);
    floatText.style.left = (x - 30) + 'px';
    floatText.style.top = (y - 10) + 'px';
    zone.appendChild(floatText);

    setTimeout(function() { floatText.remove(); }, 800);
  }

  /* ── 挂机收益 ── */
  function idleTick() {
    if (state.goldPerSec <= 0) return;
    var gain = state.goldPerSec / 10;
    state.gold += gain;
    state.totalGold += gain;
    state.autoGold += gain;
    updateDisplay();
  }

  /* ── 轮回转生 ── */
  function prestige() {
    if (state.totalGold < 10000) {
      alert('需要累计获得至少 1万 金币才能轮回转生！');
      return;
    }

    // 每累计 1万 金币可轮回 1 次，一次性完成
    var times = Math.floor(state.totalGold / 10000);
    // 记录本次轮回的金币（最高单次）
    if (state.totalGold > state.maxPrestigeGold) state.maxPrestigeGold = state.totalGold;
    state.prestigeCount += times;
    state.prestigeMultiplier = 1 + state.prestigeCount * 0.5;

    // 检查是否有新成就解锁
    checkAllAchievements();

    // 自动穿戴所有已解锁的成就（每个解锁的成就穿戴 1 次）
    // 使用持久化存储的解锁列表，确保重生后自动穿戴所有历史解锁的成就
    state.equippedTitles = {};
    state.unlockedAchievements.forEach(function(achId) {
      state.equippedTitles[achId] = 1;
    });

    state.gold = 0;
    state.totalGold = 0;
    state.autoMining = true;
    initUpgrades();
    recalcStats();
    renderContent();
    bindEvents();
    updateDisplay();
    saveState();
  }

  /* ── 重置游戏 ── */
  function resetGame() {
    if (!confirm('确定要重置所有游戏数据吗？\n（本地存档也会被清除）')) return;
    
    // 询问是否清除成就（成就默认永久保留）
    var clearAchievements = confirm('是否同时清除已解锁的成就？\n（成就默认永久保留，除非选择清除）');
    
    state.gold = 0;
    state.totalGold = 0;
    state.clickPower = 1;
    state.goldPerSec = 0;
    state.prestigeCount = 0;
    state.prestigeMultiplier = 1;
    state.autoMining = true;
    state.clickCount = 0;
    state.manualGold = 0;
    state.autoGold = 0;
    state.critCount = 0;
    state.critGold = 0;
    state.maxClickPower = 0;
    state.maxGoldPerSec = 0;
    state.maxPrestigeGold = 0;
    state.equippedTitles = {};
    
    // 如果选择清除成就
    if (clearAchievements) {
      state.unlockedAchievements = [];
      localStorage.removeItem(ACHIEVEMENTS_KEY);
    }
    
    initUpgrades();
    clearLocalSave();
    renderContent();
    bindEvents();
    updateDisplay();
    showToast('🗑️ 游戏已重置' + (clearAchievements ? '（含成就）' : ''));
  }

  /* ── 更新显示（原地更新，不重建DOM） ── */
  function updateDisplay() {
    var goldEl = document.getElementById('g3Gold');
    var clickEl = document.getElementById('g3ClickPower');
    var gpsEl = document.getElementById('g3GPS');
    if (goldEl) goldEl.textContent = formatGold(state.gold);
    if (clickEl) clickEl.textContent = formatSci(state.clickPower);
    if (gpsEl) gpsEl.textContent = formatSci(state.goldPerSec);

    // 详细统计面板（所有数字使用科学计数法）
    var cc = document.getElementById('g3ClickCount');
    if (cc) cc.textContent = formatSci(state.clickCount);
    var mg = document.getElementById('g3ManualGold');
    if (mg) mg.textContent = formatGold(state.manualGold);
    var ag = document.getElementById('g3AutoGold');
    if (ag) ag.textContent = formatGold(state.autoGold);
    var tg = document.getElementById('g3TotalGold');
    if (tg) tg.textContent = formatGold(state.totalGold);
    var ccount = document.getElementById('g3CritCount');
    if (ccount) ccount.textContent = formatSci(state.critCount);
    var cgold = document.getElementById('g3CritGold');
    if (cgold) cgold.textContent = formatGold(state.critGold);
    var gm = document.getElementById('g3GlobalMult');
    if (gm) {
      var auto2Lv = state.upgrades.auto2 || 0;
      var critLv = state.upgrades.crit || 0;
      var pickaxeMult = 1 + auto2Lv * 0.5;
      var extraCritLv = Math.max(critLv - 19, 0);
      var critGlobalMult = 1 + extraCritLv * 0.5;
      var titleBonus = getTitleMultiplier();
      var titleMult = 1 + titleBonus;
      var globalMult = pickaxeMult * critGlobalMult * titleMult;
      gm.textContent = 'x' + formatSci(globalMult);
    }
    var as = document.getElementById('g3AutoSpeed');
    if (as) {
      var auto1Lv = state.upgrades.auto1 || 0;
      var autoSpeed = 1 + auto1Lv * 0.5;
      as.textContent = formatSci(autoSpeed) + '/秒';
    }
    var tb = document.getElementById('g3TitleBonus');
    if (tb) {
      var bonus = getTitleMultiplier() * 100;
      tb.textContent = '+' + formatSci(bonus) + '%';
    }
    var mcp = document.getElementById('g3MaxClickPower');
    if (mcp) mcp.textContent = formatSci(state.maxClickPower);
    var mgps = document.getElementById('g3MaxGoldPerSec');
    if (mgps) mgps.textContent = formatSci(state.maxGoldPerSec);
    var mpg = document.getElementById('g3MaxPrestigeGold');
    if (mpg) mpg.textContent = formatSci(state.prestigeCount);

    // 原地更新商店按钮的金额和可购买状态（不重建DOM）
    var items = document.querySelectorAll('.g3-shop-item');
    items.forEach(function(item) {
      var id = item.dataset.id;
      if (!id) return;
      var u = UPGRADES.find(function(x) { return x.id === id; });
      if (!u) return;
      var lv = state.upgrades[id] || 0;
      var cost = Math.floor(u.baseCost * Math.pow(u.costMult, lv));
      item.classList.toggle('can-afford', state.gold >= cost);
      var costEl = item.querySelector('.g3-shop-cost');
      if (costEl) costEl.textContent = '💰 ' + formatGold(cost);
    });
  }

  /* ── 格式化金币 ── */
  function formatGold(val) {
    if (val == null || !isFinite(val) || val < 0) val = 0;
    // 1亿及以上使用科学计数法，保留2位小数
    if (val >= 100000000) {
      return val.toExponential(2);
    }
    // 1亿以下正常显示，保留2位小数
    return val.toFixed(2);
  }

  /* ── 简洁的科学计数法（用于倍率、点击值等）── */
  function formatSci(val) {
    if (val == null || !isFinite(val) || val < 0) val = 0;
    return val.toExponential(2);
  }

  /* ── 绑定事件 ── */
  function bindEvents() {
    var zone = document.getElementById('g3ClickZone');
    if (zone) {
      zone.addEventListener('click', handleClick);
      zone.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleClick(e);
      }, { passive: false });
    }

    var toggleBtn = document.getElementById('g3AutoToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleAutoMining);

    var prestigeBtn = document.getElementById('g3PrestigeBtn');
    if (prestigeBtn) prestigeBtn.addEventListener('click', prestige);

    var resetBtn = document.getElementById('g3ResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetGame);

    var lbBtn = document.getElementById('g3LeaderboardBtn');
    if (lbBtn) lbBtn.addEventListener('click', submitToLeaderboard);

    var saveBtn = document.getElementById('g3SaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', manualSave);

    var loadBtn = document.getElementById('g3LoadBtn');
    if (loadBtn) loadBtn.addEventListener('click', manualLoad);

    var exportBtn = document.getElementById('g3ExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportSave);

    var importBtn = document.getElementById('g3ImportBtn');
    if (importBtn) importBtn.addEventListener('click', importSave);
  }

  /* ── 提交到排行榜 ── */
  function submitToLeaderboard() {
    if (typeof PaiHangBang === 'undefined' || !PaiHangBang.submitScore) {
      alert('排行榜模块未加载！');
      return;
    }
    if (state.totalGold < 100) {
      alert('总金币太少（至少 100），继续挖宝吧！');
      return;
    }
    PaiHangBang.submitScore('game3', Math.floor(state.totalGold), {
      prestige: state.prestigeCount,
      multiplier: state.prestigeMultiplier,
      gold: Math.floor(state.gold)
    });
    // 刷新排行榜显示
    if (PaiHangBang.refreshAll) PaiHangBang.refreshAll();
  }

  /* ── 初始化排行榜嵌入区 ── */
  function initLeaderboard() {
    if (typeof PaiHangBang === 'undefined') return;
    // 填充玩家名称
    var nameInput = document.getElementById('lbNameInput_game3');
    if (nameInput) {
      nameInput.value = PaiHangBang.getPlayerName();
      nameInput.addEventListener('change', function() { PaiHangBang.setPlayerName(this.value); });
      nameInput.addEventListener('blur', function() { PaiHangBang.setPlayerName(this.value); });
    }
    // 渲染排行榜
    var listEl = document.getElementById('lbList_game3');
    if (listEl) PaiHangBang.renderRankList(listEl, 'game3');
  }

  /* ── 停止游戏（清理资源） ── */
  function stop() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }
    if (infoTimer) {
      clearInterval(infoTimer);
      infoTimer = null;
    }
    // 清理游戏弹窗
    document.querySelectorAll('.g3-offline-overlay').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.g3-toast').forEach(function(el) { el.remove(); });
    Mode.Debug.log(CONFIG.debugTag, '挂机挖宝游戏已停止');
  }

  /* ── 初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;

    // 加载成就解锁状态（持久化存储）
    loadAchievements();

    var hasSave = loadState();
    if (!hasSave) initUpgrades();
    // 数据迁移：确保所有满足条件的已解锁成就都被记录到持久化列表
    //（修复旧用户添加成就持久化前的历史数据未记录问题）
    checkAllAchievements();
    recalcStats();
    renderContent();
    bindEvents();
    updateDisplay();
    updateSaveInfo();

    autoTimer = setInterval(idleTick, 100);
    // 每 30 秒更新一次存档信息显示
    infoTimer = setInterval(updateSaveInfo, 30000);
    // 每 5 秒检查一次成就解锁状态
    achievementTimer = setInterval(checkAllAchievements, 5000);

    // 页面关闭前自动保存
    window.addEventListener('beforeunload', function() {
      saveState(true);
    });

    // 后台尝试从云端恢复成就（不阻塞初始化）
    setTimeout(function() {
      restoreAchievementsFromCloud().then(function(success) {
        if (success) {
          // 如果从云端恢复了成就，刷新显示
          recalcStats();
          renderContent();
          updateDisplay();
        }
      });
    }, 2000);

    Mode.Debug.log(CONFIG.debugTag, '✅ 挂机挖宝游戏已就绪 ' + (hasSave ? '（已恢复存档 + 离线收益）' : '（新游戏）'));
  }

  /* ── 页面激活时调用（由 zuo.js 调用） ── */
  function onActivate() {
    // 如果还未初始化，进行初始化
    if (!initialized) {
      init();
    } else {
      // 已初始化但定时器可能被 stop() 清除，需要重启
      if (!autoTimer) {
        autoTimer = setInterval(idleTick, 100);
      }
      if (!infoTimer) {
        infoTimer = setInterval(updateSaveInfo, 30000);
      }
    }
    Mode.Debug.log(CONFIG.debugTag, '挖宝游戏页面已激活');
  }

  /* ── 页面失活时调用（由 zuo.js 调用） ── */
  function onDeactivate() {
    stop();
  }

  Mode.ready(init);

  return { init, stop, onActivate, onDeactivate };
})();
