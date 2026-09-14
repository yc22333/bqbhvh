/* ============================================================
   biaoti.js — 下单跑刀（英雄区）交互逻辑
   功能: 下单跑刀标题区的动态效果与交互
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-10] [SELF-CONTAINED]
   ============================================================ */

const PaoDaoBiaoti = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    debugTag: 'PaoDaoBiaoti',
  };

  /* ── 内部状态 ── */
  let initialized = false;

  /* ── 初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;

    /* 标题区域暂无 JavaScript 交互逻辑，保留模块骨架
       后续可在此添加下单跑刀数据的动态渲染等功能 */

    Mode.Debug.log(CONFIG.debugTag, '下单跑刀标题模块已就绪 ✅');
  }

  /* ── 自动初始化 ── */
  Mode.ready(init);

  /* ── 公开 API ── */
  return {
    init,
  };
})();

// ====================== 主模块（仅展示官方标价） ======================
const PaoDao = (() => {
  'use strict';

  const CONFIG = { debugTag: 'PaoDao' };
  let initialized = false;

  /* ── 渲染官方标价 + 头像球 + 免责 + 须知 ── */
  function renderContent() {
    var container = document.getElementById('paodaoContent');
    if (!container) { Mode.Debug.warn(CONFIG.debugTag, 'DOM #paodaoContent 不存在'); return; }

    container.innerHTML = '';

    var frag = document.createDocumentFragment();
    function APP(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); frag.appendChild(t.content); }

    // 官方标价（醒目卡片）
    APP('<div class="pd-price-card">' +
        '<div class="pd-price-card-title">🏷️ 比奇堡官方标价</div>' +
        '<div class="pd-price-card-row">' +
          '<span class="pd-price-value">9格 55千万</span>' +
          '<span class="pd-price-divider">｜</span>' +
          '<span class="pd-price-value">6格 65千万</span>' +
        '</div>' +
        '<div class="pd-price-note-text">官方标价仅供参考，实际成交价格以老板打手自行商议为准</div>' +
      '</div>');

    // 👤 派单认准窗口
    APP('<div class="pd-avatar-frame">' +
      '<div class="pd-avatar-title">👑 派单认准以下成员</div>' +
      '<div class="pd-avatar-row">' +
      '<div class="pd-avatar-ball">' +
      '<div class="pd-avatar-icon"><img src="photo/biqibao/pilaoban.jpg" alt="痞老板"></div>' +
      '<div class="pd-avatar-name">痞老板</div>' +
      '<div class="pd-avatar-role" data-wechat="待定">微信：待定</div>' +
      '<button class="pd-avatar-copy" data-wechat="待定">复制微信号</button>' +
      '</div>' +
      '<div class="pd-avatar-ball">' +
      '<div class="pd-avatar-icon"><img src="photo/biqibao/fulanke.jpg" alt="弗兰克"></div>' +
      '<div class="pd-avatar-name">弗兰克</div>' +
      '<div class="pd-avatar-role" data-wechat="Top_Saku1a">微信：Top_Saku1a</div>' +
      '<button class="pd-avatar-copy" data-wechat="Top_Saku1a">复制微信号</button>' +
      '</div>' +
      '<div class="pd-avatar-ball">' +
      '<div class="pd-avatar-icon"><img src="photo/biqibao/shidifu.jpg" alt="史蒂夫"></div>' +
      '<div class="pd-avatar-name">史蒂夫</div>' +
      '<div class="pd-avatar-role" data-wechat="zsdgssc12369">微信：zsdgssc12369</div>' +
      '<button class="pd-avatar-copy" data-wechat="zsdgssc12369">复制微信号</button>' +
      '</div></div>' +
      '<div class="pd-avatar-note">⚠️ 派单仅认准：痞老板、弗兰克、史蒂夫</div></div>');

    // 底部并排：免责声明（左）+ 跑刀须知（右）
    APP('<div class="pd-bottom-row">' +
      '<div class="pd-bottom-left">' +
      '<div class="pd-warn-box">' +
      '<div class="pd-warn-title">⚠️ 免责声明</div>' +
      '仅认可以上成员/章鱼哥的订单，私下订单无效\n' +
      '私自线下交易产生损失，本店概不负责\n' +
      '非本店订单，本店不提供相关资料与凭证\n' +
      '上下账号请提前协商，顶号造成损失由号主承担</div>' +
      '</div>' +
      '<div class="pd-bottom-right">' +
      '<div class="pd-tips-box">' +
      '<div class="pd-tips-title">📋 跑刀须知</div>' +
      '跑刀只算现金增加，如需要保留物品提前确认\n' +
      '默认只保留星/泪，其余物资保留按市场价计算\n' +
      '未确认保留或老板未回应，打手会直接变卖成资产\n' +
      '非洲之星海洋之泪默认算1.5倍哈夫币并保留</div>' +
      '</div>' +
      '</div>');

    container.appendChild(frag);
    Mode.Debug.log(CONFIG.debugTag, '内容渲染完成 ✅');
  }

  /* ── 公共初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;
    renderContent();

    /* ── 微信号复制 ── */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.pd-avatar-copy');
      if (!btn) return;
      var wechat = btn.getAttribute('data-wechat');
      if (!wechat) return;
      navigator.clipboard.writeText(wechat).then(function() {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = '复制微信号';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = wechat;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = '复制微信号';
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    Mode.Debug.log(CONFIG.debugTag, '下单跑刀模块已就绪 ✅');
  }

  Mode.ready(init);

  return { init };
})();