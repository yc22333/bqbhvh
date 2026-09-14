/* ============================================================
   huishou.js — 哈夫币回收报价计算模块
   功能: 表单动态渲染 + 回收价格计算
   逻辑: 保持与原 CoinRecycle.js 完全一致
   参考: awm.js 选项按钮 + 输入框交互模式
   [CREATED: 2026-06-10] [UPDATED: 2026-06-10]
   ============================================================ */

// ====================== 标题模块 ======================
const HaFuBiHuiShouBiaoti = (() => {
  'use strict';
  const CONFIG = { debugTag: 'HaFuBiHuiShouBiaoti' };
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    Mode.Debug.log(CONFIG.debugTag, '哈夫币回收标题模块已就绪 ✅');
  }
  Mode.ready(init);
  return { init };
})();

// ====================== 主计算模块 ======================
const HaFuBiHuiShou = (() => {
  'use strict';

  const CONFIG = { debugTag: 'HaFuBiHuiShou' };

  /** ═══ 状态变量 —— 与原 CoinRecycle.js 完全一致 ═══ */
  let rentRate  = 1;    // 费率倍率（租号需排队=1, 急租=0.7）
  let shortBan  = 0;    // 封号记录 0=无 1=有
  let hasKnife  = 0;    // 有刀
  let hasRed    = 0;    // 有红皮
  let hasGun    = 0;    // 有砖皮
  let trainLv   = 0;    // 体力满级
  let shootLv   = 0;    // 负重满级
  let gridNum   = 4;    // 安全箱等级 4/2/0
  let loginTime = 0;    // 上号时间 0=全天 1=需商议

  let initialized = false;
  let container = null;

  /* ── 安全读取输入值 ── */
  const getNum = id => Math.max(Number(document.getElementById(id)?.value) || 0, 0);

  /* ── 切换开关组状态 ── */
  const setSwitch = (group, value) => {
    if (!container) return;
    container.querySelectorAll('[data-switch="' + group + '"]').forEach(btn => {
      btn.classList.toggle('active', String(btn.dataset.value) === String(value));
    });
  };

  /* ── 渲染表单 HTML ── */
  function renderContent() {
    container = document.getElementById('hafubihuishouContent');
    if (!container) { Mode.Debug.warn(CONFIG.debugTag, 'DOM #hafubihuishouContent 不存在'); return; }

    container.innerHTML = '';

    // 使用 DocumentFragment 批量构建
    const frag = document.createDocumentFragment();
    const APP = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); };

    APP('<div class="hs-tabs">' +
      '<div class="hs-tab active" data-rate="0.7">急租（无需排队费用-30%）<br><span class="hs-tab-sub">需要安排打手上号，时间以打手为准</span></div>' +
      '<div class="hs-tab" data-rate="1">租号（需排队正常结算）<br><span class="hs-tab-sub">需要安排打手上号，时间以打手为准</span></div></div>');

    // 开关行 - 双列布局（每行2个开关组）
    const switchRows = [
      { label:'是否有封号记录', desc:'', name:'ban',  opts:[[0,'无'],[1,'有']], three:false },
      { label:'是否有刀', desc:'', name:'knife', opts:[[0,'无'],[1,'有']], three:false },
      { label:'是否有红皮', desc:'', name:'red',   opts:[[0,'无'],[1,'有']], three:false },
      { label:'是否有砖皮', desc:'', name:'gun',   opts:[[0,'无'],[1,'有']], three:false },
      { label:'体力是否满级', desc:'', name:'train', opts:[[0,'未满级'],[1,'满级']], three:false },
      { label:'负重是否满级', desc:'', name:'shoot', opts:[[0,'未满级'],[1,'满级']], three:false },
      { label:'安全箱等级', desc:'', name:'grid',  opts:[[4,'4格以下'],[2,'6格'],[0,'9格']], three:true },
      { label:'上号时间', desc:'', name:'loginTime', opts:[[0,'全天'],[1,'需商议']], three:false },
    ];

    // 辅助：生成完整的开关组HTML（标签+按钮）
    function renderSwitchGroup(r) {
      var ac = ' active';
      var btns = r.opts.map(function(o, i) {
        return '<div class="hs-switch-btn' + (i === 0 ? ac : '') + '" data-switch="' + r.name + '" data-value="' + o[0] + '">' + o[1] + '</div>';
      }).join('');
      return '<div class="hs-switch-item">' +
        '<div class="hs-switch-label">' + r.label + '</div>' +
        '<div class="hs-switch-btn-group">' + btns + '</div>' +
      '</div>';
    }

    // 双列网格：每行2个开关组
    var sgHtml = '';
    for (var i = 0; i < 8; i += 2) {
      sgHtml += renderSwitchGroup(switchRows[i]);
      sgHtml += renderSwitchGroup(switchRows[i + 1]);
    }
    APP('<div class="hs-switch-grid">' + sgHtml + '</div>');

    // 物品输入 - 双列布局（前6个物品两两配对，第7个是六级甲，第8个是回收报价）
    var items = [
      { name:'哈夫币数量', unit:'（单位：W）', hint:'只算现金资产不计入', id:'hs_coin', idL:'hs_coin_left' },
      { name:'AWM子弹数量', unit:'（单位：发）', hint:'金弹不计入', id:'hs_awNum', idL:'hs_awNum_left' },
      { name:'其余红弹数量', unit:'（单位：组）', hint:'少于60发不计入', id:'hs_redAmmo', idL:'hs_redAmmo_left' },
      { name:'45格吞天包', unit:'（单位：个）', hint:'', id:'hs_tianBao', idL:'hs_tianBao_left' },
      { name:'其他红包', unit:'（单位：个）', hint:'金包不计入', id:'hs_normalBag', idL:'hs_normalBag_left' },
      { name:'六级头', unit:'（单位：个）', hint:'', id:'hs_liuTou', idL:'hs_liuTou_left' },
      { name:'六级甲', unit:'（单位：个）', hint:'', id:'hs_liuJia', idL:'hs_liuJia_left' },
    ];

    // 辅助：生成物品卡片HTML
    function renderItemCard(item) {
      var hintHtml = item.hint ? '<div class="hs-item-hint">' + item.hint + '</div>' : '';
      return '<div class="hs-item-card">' +
        '<div class="hs-item-header">' +
          '<span class="hs-item-name">' + item.name + '</span>' +
          '<span class="hs-item-unit">' + item.unit + '</span>' +
        '</div>' +
        hintHtml +
        '<div class="hs-input-row">' +
          '<span class="hs-input-label">下单时总量：</span>' +
          '<input type="number" class="hs-input-field" id="' + item.id + '" placeholder="总量" min="0">' +
        '</div>' +
        '<div class="hs-input-row">' +
          '<span class="hs-input-label">结单后剩余：</span>' +
          '<input type="number" class="hs-input-field" id="' + item.idL + '" placeholder="剩余量" min="0">' +
        '</div>' +
      '</div>';
    }

    // 生成物品网格HTML（前6个物品 + 六级甲 + 回收报价）
    var itemsHtml = '';
    for (var i = 0; i < 6; i += 2) {
      itemsHtml += renderItemCard(items[i]);
      itemsHtml += renderItemCard(items[i + 1]);
    }
    // 第7个：六级甲
    itemsHtml += renderItemCard(items[6]);
    // 第8个：回收报价（特殊卡片）
    itemsHtml += '<div class="hs-item-card hs-price-card">' +
      '<div class="hs-item-header">' +
        '<span class="hs-item-name">💎 回收报价</span>' +
      '</div>' +
      '<div class="hs-price-display" id="hs_resultPrice">0.00 元</div>' +
      '<button class="hs-reset-btn" id="hs_resetBtn">🗑️ 一键清空</button>' +
    '</div>';

    APP('<div class="hs-items-grid">' + itemsHtml + '</div>');

    // 核算总价通知
    APP('<div class="hs-total-notice"><span class="hs-total-notice-icon">✅</span><span class="hs-total-notice-text">核算总价后：截图发派单人，确认金额无误即可安排下单收货！</span></div>');

    // 👤 派单认准窗口
    APP('<div class="hs-avatar-frame">' +
      '<div class="hs-avatar-title">👑 派单认准以下成员</div>' +
      '<div class="hs-avatar-row">' +
        '<div class="hs-avatar-ball">' +
          '<div class="hs-avatar-icon"><img src="photo/biqibao/xielaoban..jpg" alt="蟹老板"></div>' +
          '<div class="hs-avatar-name">蟹老板</div>' +
          '<div class="hs-avatar-role">微信：Top-XIAOBAI-</div>' +
        '</div>' +
      '</div>' +
      '<div class="hs-avatar-note">⚠️ 派单仅认准：蟹老板</div>' +
    '</div>');

    // 警告框
    APP('<div class="hs-warn-box"><div class="hs-warn-title">⚠️ 免责声明</div>' +
      '1、仅认可蟹老板派发的订单，私下订单无效\n' +
      '2、所有订单统一存档，号主可随时核验\n' +
      '3、统一由蟹老板/蟹老板对接的打手对账结算，不私下结账\n' +
      '4、私自线下交易产生损失，本店概不负责\n' +
      '5、群内只认群主/管理员，私自联系被骗后果自负\n' +
      '6、上下账号请提前协商，顶号造成损失由当事人承担</div>');

    // 温馨提示
    APP('<div class="hs-tips-box"><div class="hs-tips-title">📋 订单赔付</div>📌 赔付参考：子弹/物资按市场价回收折半计算\n📌 哈夫币：参考市场回收价折半计算\n</div>');

    container.appendChild(frag);
    Mode.Debug.log(CONFIG.debugTag, '表单渲染完成 ✅');
  }

  /* ═══ 核心计算 —— 与原 CoinRecycle.js calcRent() 完全一致 ═══ */
  function calcRent() {
    var coin      = getNum('hs_coin');
    var aw        = getNum('hs_awNum');
    var redAmmo   = getNum('hs_redAmmo');
    var tianBao   = getNum('hs_tianBao');
    var normalBag = getNum('hs_normalBag');
    var liuTou    = getNum('hs_liuTou');
    var liuJia    = getNum('hs_liuJia');

    var coin_left      = getNum('hs_coin_left');
    var aw_left        = getNum('hs_awNum_left');
    var redAmmo_left   = getNum('hs_redAmmo_left');
    var tianBao_left   = getNum('hs_tianBao_left');
    var normalBag_left = getNum('hs_normalBag_left');
    var liuTou_left    = getNum('hs_liuTou_left');
    var liuJia_left    = getNum('hs_liuJia_left');

    var coin_use      = Math.max(coin - coin_left, 0);
    var aw_use        = Math.max(aw - aw_left, 0);
    var redAmmo_use   = Math.max(redAmmo - redAmmo_left, 0);
    var tianBao_use   = Math.max(tianBao - tianBao_left, 0);
    var normalBag_use = Math.max(normalBag - normalBag_left, 0);
    var liuTou_use    = Math.max(liuTou - liuTou_left, 0);
    var liuJia_use    = Math.max(liuJia - liuJia_left, 0);

    var lackCount = [hasKnife, hasRed, hasGun, trainLv, shootLv].filter(function(v) { return v === 0; }).length;
    var banAdd = shortBan ? 2 : 0;
    var divide = 46 + (lackCount * 2) + gridNum + banAdd;

    var baseCoin = divide > 0 ? coin_use / divide : 0;

    var goodsSum = aw_use * 0.6 + redAmmo_use * 5 + tianBao_use * 0.3
                 + normalBag_use * 0.2 + liuTou_use * 0.5 + liuJia_use * 1;

    var finalPrice = (baseCoin + goodsSum) * rentRate;

    var el = document.getElementById('hs_resultPrice');
    if (el) el.textContent = finalPrice.toFixed(2);
  }

  /* ═══ 重置表单 —— 与原 CoinRecycle.js resetRent() 一致 ═══ */
  function resetRent() {
    if (!container) return;
    container.querySelectorAll('input[type="number"]').forEach(function(i) { i.value = ''; });

    setSwitch('ban', 0);
    setSwitch('knife', 0);
    setSwitch('red', 0);
    setSwitch('gun', 0);
    setSwitch('train', 0);
    setSwitch('shoot', 0);
    setSwitch('grid', 4);
    setSwitch('loginTime', 0);

    shortBan = 0; hasKnife = 0; hasRed = 0; hasGun = 0;
    trainLv = 0; shootLv = 0; gridNum = 4;
    loginTime = 0;
    rentRate = 1;

    container.querySelectorAll('.hs-tab').forEach(function(t, i) { t.classList.toggle('active', i === 0); });
    calcRent();
    Mode.Debug.log(CONFIG.debugTag, '表单已重置 🔄');
  }

  /* ── 绑定事件 ── */
  function bindEvents() {
    if (!container) return;

    // 选项卡
    container.querySelectorAll('.hs-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        container.querySelectorAll('.hs-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        rentRate = Number(this.dataset.rate) || 1;
        calcRent();
      });
    });

    // 开关按钮
    container.querySelectorAll('[data-switch]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var group = this.dataset.switch;
        var value = Number(this.dataset.value);
        container.querySelectorAll('[data-switch="' + group + '"]').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');

        switch (group) {
          case 'ban':   shortBan = value; break;
          case 'knife': hasKnife = value; break;
          case 'red':   hasRed   = value; break;
          case 'gun':   hasGun   = value; break;
          case 'train': trainLv  = value; break;
          case 'shoot': shootLv  = value; break;
          case 'grid':  gridNum  = value; break;
          case 'loginTime': loginTime = value; break;
        }
        calcRent();
      });
    });

    // 输入框自动计算
    container.querySelectorAll('input[type="number"]').forEach(function(inp) {
      inp.addEventListener('input', calcRent);
    });

    var calcBtn = document.getElementById('hs_calcBtn');
    if (calcBtn) calcBtn.addEventListener('click', calcRent);

    var resetBtn = document.getElementById('hs_resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetRent);
  }

  /* ── 公共初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;
    renderContent();
    bindEvents();
    calcRent();
    Mode.Debug.log(CONFIG.debugTag, '哈夫币回收模块已就绪 ✅');
  }

  Mode.ready(init);

  return { init: init, calcRent: calcRent, resetRent: resetRent };
})();