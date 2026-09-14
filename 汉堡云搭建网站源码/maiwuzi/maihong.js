/* ============================================================
   maihong.js — 买物资+找锁车
   功能: 8个品类选项卡 + 物资网格展示 + 价格写死
   修改价格直接改下面的 ITEMS 数据
   ============================================================ */
(function () {
  'use strict';

  /* ── 品类列表 ── */
  var CATEGORIES = [
    '工艺藏品', '电子物品', '资料情报', '能源燃料',
    '医疗道具', '工具材料', '家居物品', '限定物品'
  ];

  /* ── 品类 → 图片文件夹映射 ── */
  var FOLDERS = {
    '工艺藏品': '1.gongyi',
    '电子物品': '2.dianzi',
    '资料情报': '3.ziliao',
    '能源燃料': '4.nengyuan',
    '医疗道具': '5.yiliao',
    '工具材料': '6.gongju',
    '家居物品': '7.jiaju',
    '限定物品': '8.xianding'
  };

  var IMG_BASE = 'photo/shoucangping/';

  /* ══════════════════════════════════════════════════════════════
     物资数据
     格式: { name: 名称, img: 图片路径(相对品类文件夹), price: 价格 }
     price = null 表示未定价
     ══════════════════════════════════════════════════════════════ */
  var ITEMS = {
    /* ═══════════════════════════════════════════════
       工艺藏品 (1.gongyi)
       图片对照 PSD 文件名:
        1/1.jpg=赛伊德怀表, 1/2.jpg=鎏金卡牌, 1/3.jpg=名贵机械表
        4/1.jpg=黄金瞪羚, 4/2.jpg=鳄鱼头, 4/3.jpg=天圆地方
        4/4.jpg=滑膛枪, 4/5.jpg=生命支持系统
        6/2.jpg=留声机, 6/3.jpg=步战车模型
        9/1.jpg=坦克模型, 9/2.jpg=万金泪冠, 9/3.jpg=纵横, 9/4.jpg=名画
       ═══════════════════════════════════════════════ */
    '工艺藏品': [
      { name: '赛伊德怀表',   img: '1/1.jpg', price: 3 },
      { name: '鎏金卡牌',     img: '1/2.jpg', price: 3 },
      { name: '名贵机械表',   img: '1/3.jpg', price: 3 },
      { name: '化石',         img: '2/1.jpg', price: 3.5 },
      { name: '金条',         img: '2/2.jpg', price: 3.5 },
      { name: '黄金瞪羚',     img: '4/1.jpg', price: 8 },
      { name: '鳄鱼头',       img: '4/2.jpg', price: 8 },
      { name: '天圆地方',     img: '4/3.jpg', price: 8 },
      { name: '滑膛枪',       img: '4/4.jpg', price: 25 },
      { name: '生命支持系统', img: '4/5.jpg', price: 8 },
      { name: '半身像',       img: '6/1.jpg', price: 15 },
      { name: '留声机',       img: '6/2.jpg', price: 15 },
      { name: '步战车模型',   img: '6/3.jpg', price: 15 },
      { name: '花瓶',         img: '8/1.jpg', price: 35 },
      { name: '坦克模型',     img: '9/1.jpg', price: 25 },
      { name: '万金泪冠',     img: '9/2.jpg', price: 68 },
      { name: '纵横',         img: '9/3.jpg', price: 68 },
      { name: '名画',         img: '9/4.jpg', price: 25 }
    ],
    /* ═══════════════════════════════════════════════
       电子物品 (2.dianzi)
       图片对照 PSD 文件名:
        1/1.jpg=定位接收器, 1/2.jpg=电子脚镣, 1/3.jpg=恒星敏感器
        4/1.jpg=卫星锅, 4/2.jpg=军用电台
        6/1.jpg=黑匣子, 6/3.jpg=军用信息终端
        12/1.jpg=高速磁盘阵列, 12/2.jpg=刀片服务器
       ═══════════════════════════════════════════════ */
    '电子物品': [
      { name: '定位接收器',    img: '1/1.jpg', price: 3 },
      { name: '电子脚镣',      img: '1/2.jpg', price: 25 },
      { name: '恒星敏感器',    img: '1/3.jpg', price: 3 },
      { name: '军用终端',      img: '2/1.jpg', price: 3.5 },
      { name: '显卡',          img: '2/2.jpg', price: 3.5 },
      { name: '卫星锅',        img: '4/1.jpg', price: 15 },
      { name: '军用电台',      img: '4/2.jpg', price: 8 },
      { name: '摄影机',        img: '4/3.jpg', price: 8 },
      { name: '无人机',        img: '4/4.jpg', price: 8 },
      { name: '黑匣子',        img: '6/1.jpg', price: 25 },
      { name: '笔记本',        img: '6/2.jpg', price: 30 },
      { name: '军用信息终端',  img: '6/3.jpg', price: 15 },
      { name: '便携军用雷达',  img: '9/1.jpg', price: 25 },
      { name: '曼德尔超算单元', img: '9/2.jpg', price: 25 },
      { name: '高速磁盘阵列',  img: '12/1.jpg', price: 35 },
      { name: '刀片服务器',    img: '12/2.jpg', price: 35 }
    ],
    /* ═══════════════════════════════════════════════
       资料情报 (3.ziliao)
       图片对照 PSD 文件名:
        1/1.jpg=量子储存, 1/2.jpg=实验数据, 1/3.jpg=渡鸦脑机
       ═══════════════════════════════════════════════ */
    '资料情报': [
      { name: '量子储存',   img: '1/1.jpg', price: 3 },
      { name: '实验数据',   img: '1/2.jpg', price: 3 },
      { name: '渡鸦脑机',   img: '1/3.jpg', price: 3 },
      { name: '监狱地图4',  img: '2/1.jpg', price: 3.5 },
      { name: '已封存音源', img: '4/1.jpg', price: 8 },
      { name: '云储存',     img: '6/1.jpg', price: 15 },
      { name: '绝密服务器', img: '9/1.jpg', price: 25 }
    ],
    /* ═══════════════════════════════════════════════
       能源燃料 (4.nengyuan)
       图片对照 PSD 文件名:
        9/1.jpg=微型反应炉, 9/2.jpg=聚变供能单元, 9/3.jpg=反应堆冷却核心
        12/1.jpg=暗星燃料, 12/2.jpg=火箭燃料, 12/3.jpg=动力电池组
       ═══════════════════════════════════════════════ */
    '能源燃料': [
      { name: '高能瓦斯罐',     img: '4/1.jpg', price: 8 },
      { name: '装甲车电池',     img: '6/1.jpg', price: 68 },
      { name: '浓缩铀样本',     img: '8/1.jpg', price: 55 },
      { name: '微型反应炉',     img: '9/1.jpg', price: 68 },
      { name: '聚变供能单元',   img: '9/2.jpg', price: 25 },
      { name: '反应堆冷却核心', img: '9/3.jpg', price: 30 },
      { name: '暗星燃料',       img: '12/1.jpg', price: 35 },
      { name: '火箭燃料',       img: '12/2.jpg', price: 35 },
      { name: '动力电池组',     img: '12/3.jpg', price: 35 }
    ],
    /* ═══════════════════════════════════════════════
       医疗道具 (5.yiliao)
       图片对照 PSD 文件名:
        9/1.jpg=复苏呼吸机, 9/2.jpg=ECMO
       ═══════════════════════════════════════════════ */
    '医疗道具': [
      { name: '呼吸机',     img: '4/1.jpg', price: 8 },
      { name: '体外除颤器', img: '6/1.jpg', price: 15 },
      { name: '医疗机器人', img: '6/2.jpg', price: 15 },
      { name: '复苏呼吸机', img: '9/1.jpg', price: 68 },
      { name: 'ECMO',       img: '9/2.jpg', price: 25 }
    ],
    /* ═══════════════════════════════════════════════
       工具材料 (6.gongju)
       图片对照 PSD 文件名:
        12/1.jpg=浮力设备 (不是 fulishebei.jpg)
       ═══════════════════════════════════════════════ */
    '工具材料': [
      { name: '牌盒',         img: '1/1.jpg', price: 268 },
      { name: '超声波切割刀', img: '1/2.jpg', price: 3 },
      { name: '飞秒激光器',   img: '3/1.jpg', price: 15 },
      { name: '军用炮弹',     img: '6/1.jpg', price: 15 },
      { name: '测距仪',       img: '8/cejuyi.jpg', price: 45 },
      { name: '碳纤维板',     img: '9/1.jpg', price: 25 },
      { name: '浮力设备',     img: '12/1.jpg', price: 35 }
    ],
    /* ═══════════════════════════════════════════════
       家居物品 (7.jiaju)
       图片对照 PSD 文件名:
        2/1.jpg=香槟, 2/2.jpg=咖啡豆
       ═══════════════════════════════════════════════ */
    '家居物品': [
      { name: '鱼子酱',     img: '1/1.jpg', price: 3 },
      { name: '香槟',       img: '2/1.jpg', price: 3.5 },
      { name: '咖啡豆',     img: '2/2.jpg', price: 3.5 },
      { name: '强力吸尘器', img: '6/1.jpg', price: 15 },
      { name: '扫托一体',   img: '9/1.jpg', price: 25 },
      { name: '打字机',     img: '12/daziji.jpg', price: 128 }
    ],
    /* ═══════════════════════════════════════════════
       限定物品 (8.xianding)
       图片对照 PSD 文件名:
        1/1.jpg=吴彦祖之镜, 1/2.jpg=至纯源石, 1/3.jpg=炫彩鸟蛋
        1/4.jpg=渡鸦-1, 1/5.jpg=极品平安果, 1/6.jpg=勇者之证
        2/1.jpg=幸运木雕, 2/2.jpg=契约钥匙, 2/3.jpg=炫彩露娜
        2/4.jpg=炫彩麦小蛋, 2/5.jpg=炫彩克小圈, 2/6.jpg=阿米娅近卫
        2/7.jpg=炫彩兰小登, 2/8.jpg=炫彩拉小宅, 2/9.jpg=比例狼面具
        2/10.jpg=炫彩威小龙, 2/11.jpg=手弩赤小霄, 2/12.jpg=红鲤鱼王
        2/13.jpg=炫彩乌小蛋, 2/14.jpg=劳拉手办, 2/15.jpg=肯小桶
        4/1.jpg=巨兽机甲, 4/2.jpg=乙巳玄武, 4/3.jpg=马上起飞
        4/4.jpg=马上转运, 4/5.jpg=炫彩足球, 4/6.jpg=6级弹, 4/7.jpg=黄金鸟窝
        6/1.jpg=外星人笔记本电脑
       ═══════════════════════════════════════════════ */
    '限定物品': [
      { name: '吴彦祖之镜', img: '1/1.jpg', price: 35 },
      { name: '至纯源石',   img: '1/2.jpg', price: 35 },
      { name: '炫彩鸟蛋',   img: '1/3.jpg', price: 128 },
      { name: '渡鸦-1',     img: '1/4.jpg', price: 35 },
      { name: '极品平安果', img: '1/5.jpg', price: 35 },
      { name: '勇者之证',   img: '1/6.jpg', price: 55 },
      { name: '幸运木雕',   img: '2/1.jpg', price: 35 },
      { name: '契约钥匙',   img: '2/2.jpg', price: 35 },
      { name: '炫彩露娜',   img: '2/3.jpg', price: 78 },
      { name: '炫彩麦小蛋', img: '2/4.jpg', price: 128 },
      { name: '炫彩克小圈', img: '2/5.jpg', price: 55 },
      { name: '阿米娅近卫', img: '2/6.jpg', price: 45 },
      { name: '炫彩兰小登', img: '2/7.jpg', price: 55 },
      { name: '炫彩拉小宅', img: '2/8.jpg', price: 55 },
      { name: '比例狼面具', img: '2/9.jpg', price: 45 },
      { name: '炫彩威小龙', img: '2/10.jpg', price: 55 },
      { name: '手弩赤小霄', img: '2/11.jpg', price: 45 },
      { name: '红鲤鱼王',   img: '2/12.jpg', price: 45 },
      { name: '炫彩乌小蛋', img: '2/13.jpg', price: 55 },
      { name: '劳拉手办',   img: '2/14.jpg', price: 45 },
      { name: '肯小桶',     img: '2/15.jpg', price: 45 },
      { name: '烽火杯',       img: '3/1.jpg', price: 45 },
      { name: '巨兽机甲',     img: '4/1.jpg', price: 45 },
      { name: '乙巳玄武',     img: '4/2.jpg', price: 88 },
      { name: '马上起飞',     img: '4/3.jpg', price: 55 },
      { name: '马上转运',     img: '4/4.jpg', price: 55 },
      { name: '炫彩足球',     img: '4/5.jpg', price: 55 },
      { name: '6级弹',        img: '4/6.jpg', price: 45 },
      { name: '黄金鸟窝',     img: '4/7.jpg', price: 55 },
      { name: '外星人笔记本电脑', img: '6/1.jpg', price: 888 }
    ]
  };

  /* ── 当前选中的品类 ── */
  var currentCategory = '工艺藏品';

  /* ── 容器 ── */
  var container = null;

  /* ══════════════════════════════════════════════════════════════
     购物车数据
     ══════════════════════════════════════════════════════════════ */
  var cart = [];

  /* ── 通过物品名称查找格数 ── */
  function getItemGrid(name) {
    for (var cat in ITEMS) {
      if (ITEMS.hasOwnProperty(cat)) {
        var list = ITEMS[cat];
        for (var i = 0; i < list.length; i++) {
          if (list[i].name === name) {
            var parts = list[i].img.split('/');
            if (parts.length >= 2) return parseInt(parts[0], 10) || 0;
            return 0;
          }
        }
      }
    }
    return 0;
  }

  /* ── 加入购物车（自动排序：格数越小越靠上） ── */
  function addToCart(name, price) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name) {
        cart[i].quantity++;
        updateCartDisplay();
        return;
      }
    }
    var grid = getItemGrid(name);
    var insertIdx = cart.length;
    for (var j = 0; j < cart.length; j++) {
      if (grid < cart[j].grid) {
        insertIdx = j;
        break;
      }
    }
    cart.splice(insertIdx, 0, { name: name, price: price, grid: grid, quantity: 1 });
    updateCartDisplay();
  }

  /* ── 移出购物车 ── */
  function removeFromCart(name) {
    var newCart = [];
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name !== name) {
        newCart.push(cart[i]);
      }
    }
    cart = newCart;
    updateCartDisplay();
  }

  /* ── 修改数量 ── */
  function changeQuantity(name, delta) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name) {
        cart[i].quantity += delta;
        if (cart[i].quantity <= 0) {
          cart.splice(i, 1);
        }
        updateCartDisplay();
        return;
      }
    }
  }

  /* ── 计算总计 ── */
  function getCartTotal() {
    var total = 0;
    for (var i = 0; i < cart.length; i++) {
      total += cart[i].price * cart[i].quantity;
    }
    return total;
  }

  /* ── 计算总件数 ── */
  function getCartCount() {
    var count = 0;
    for (var i = 0; i < cart.length; i++) {
      count += cart[i].quantity;
    }
    return count;
  }

  /* ── 获取某个物品在购物车中的数量 ── */
  function getItemQuantity(name) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].name === name) return cart[i].quantity;
    }
    return 0;
  }

  /* ── 更新购物车显示 ── */
  function updateCartDisplay() {
    renderCartPanel();
    updateCartSummary();
    updateGridQtys();
  }

  /* ── 更新网格里每个物品的数量显示 ── */
  function updateGridQtys() {
    var items = container.querySelectorAll('.maiwuzi-item');
    for (var i = 0; i < items.length; i++) {
      var qtyEl = items[i].querySelector('.maiwuzi-item-qty');
      if (!qtyEl) continue;
      var name = qtyEl.getAttribute('data-name');
      if (!name) continue;
      var qty = getItemQuantity(name);
      qtyEl.textContent = qty;
    }
  }

  /* ── 更新角标（面板头部显示） ── */
  function updateCartSummary() {
    var summary = document.getElementById('cartPanelSummary');
    var totalEl = document.getElementById('cartPanelTotal');
    var bodyTotal = document.getElementById('cartBodyTotal');
    var count = getCartCount();
    var total = getCartTotal();
    if (summary) summary.textContent = count + ' 件商品';
    if (totalEl) totalEl.textContent = total;
    if (bodyTotal) bodyTotal.textContent = total;
  }

  /* ── 渲染购物车面板内容 ── */
  function renderCartPanel() {
    var list = document.getElementById('cartPanelItems');
    var totalEl = document.getElementById('cartPanelTotal');
    var bodyTotal = document.getElementById('cartBodyTotal');
    var summary = document.getElementById('cartPanelSummary');
    if (!list) return;

    var count = getCartCount();
    var total = getCartTotal();
    if (summary) summary.textContent = count + ' 件商品';
    if (totalEl) totalEl.textContent = total;
    if (bodyTotal) bodyTotal.textContent = total;

    // 重置复制按钮文字
    var copyBtns = document.querySelectorAll('.cart-code-copy');
    for (var ci = 0; ci < copyBtns.length; ci++) {
      if (copyBtns[ci].textContent !== '复制购物清单') {
        copyBtns[ci].textContent = '复制购物清单';
        copyBtns[ci].classList.remove('copied');
      }
    }

    if (cart.length === 0) {
      list.innerHTML = '<div class="cart-empty">购物车是空的</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var subtotal = (item.price * item.quantity).toFixed(1);
      if (subtotal.indexOf('.0') === subtotal.length - 2) {
        subtotal = subtotal.slice(0, -2);
      }
      html += '<div class="cart-item-row">';
      html += '<div class="cart-item-qty">' + item.quantity + '</div>';
      html += '<div class="cart-item-name">' + item.name + '</div>';
      html += '<div class="cart-item-subtotal">' + subtotal + '元</div>';
      html += '<div class="cart-item-actions">';
      html += '<button class="cart-qty-btn cart-qty-minus" data-name="' + item.name.replace(/"/g, '&quot;') + '">−</button>';
      html += '<button class="cart-qty-btn cart-qty-plus" data-name="' + item.name.replace(/"/g, '&quot;') + '">+</button>';
      html += '<button class="cart-item-del" data-name="' + item.name.replace(/"/g, '&quot;') + '">✕</button>';
      html += '</div>';
      html += '</div>';
    }
    list.innerHTML = html;

    // 绑定购物车事件
    var plusBtns = list.querySelectorAll('.cart-qty-plus');
    var minusBtns = list.querySelectorAll('.cart-qty-minus');
    var delBtns = list.querySelectorAll('.cart-item-del');

    for (var i = 0; i < plusBtns.length; i++) {
      plusBtns[i].addEventListener('click', function () {
        changeQuantity(this.getAttribute('data-name'), 1);
      });
    }
    for (var i = 0; i < minusBtns.length; i++) {
      minusBtns[i].addEventListener('click', function () {
        changeQuantity(this.getAttribute('data-name'), -1);
      });
    }
    for (var i = 0; i < delBtns.length; i++) {
      delBtns[i].addEventListener('click', function () {
        removeFromCart(this.getAttribute('data-name'));
      });
    }
  }

  /* ── 切换购物车面板展开/收起 ── */
  function toggleCartPanel() {
    var panel = document.getElementById('cartPanel');
    var body = document.getElementById('cartPanelBody');
    if (!panel || !body) return;

    var isExpanding = !panel.classList.contains('cart-expanded');

    // 清除正在运行的动画
    if (body._anim) {
      body._anim.cancel();
      body._anim = null;
    }

    if (isExpanding) {
      // 1. 先渲染内容（此时 body 是隐藏状态，用户看不见）
      renderCartPanel();

      // 2. 临时去掉 max-height 限制，测量实际内容高度
      body.style.transition = 'none';
      body.style.maxHeight = 'none';
      var fullHeight = body.offsetHeight;
      body.style.maxHeight = '0px';
      void body.offsetHeight; // 强制回流

      // 3. 存储实际高度用于后续收起动画
      body.dataset.fullHeight = fullHeight;

      // 4. 添加展开 class
      panel.classList.add('cart-expanded');

      // 5. 用 Web Animations API 驱动平滑过渡
      body._anim = body.animate([
        { maxHeight: '0px', opacity: 0 },
        { maxHeight: fullHeight + 'px', opacity: 1 }
      ], {
        duration: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
      });

      // 6. 动画完成后清除 WAAPI，让 CSS 接管高度限制
      body._anim.onfinish = function () {
        var anim = body._anim;
        body._anim = null;
        if (anim) anim.cancel(); // ← 取消 WAAPI 才能解除 fill:forwards 锁定
        body.style.maxHeight = '';
        body.style.opacity = '';
        body.style.transition = '';
      };
    } else {
      // 1. 清除之前可能残留的内联样式
      body.style.transition = 'none';
      body.style.maxHeight = '';
      body.style.opacity = '';

      // 2. 从存储的高度开始收起
      var startHeight = parseInt(body.dataset.fullHeight) || body.offsetHeight || 200;
      if (startHeight < 1) startHeight = 200;

      panel.classList.remove('cart-expanded');

      // 3. 用 Web Animations API 驱动平滑过渡
      body._anim = body.animate([
        { maxHeight: startHeight + 'px', opacity: 1 },
        { maxHeight: '0px', opacity: 0 }
      ], {
        duration: 400,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
      });

      // 4. 动画完成后清除 WAAPI，回到 CSS 默认隐藏状态
      body._anim.onfinish = function () {
        var anim = body._anim;
        body._anim = null;
        if (anim) anim.cancel(); // ← 取消 WAAPI 解除锁定
        body.style.maxHeight = '';
        body.style.opacity = '';
        body.style.transition = '';
      };
    }
  }

  /* ── 清空购物车 ── */
  function clearCart() {
    cart = [];
    updateCartDisplay();
  }

  /* ══════════════════════════════════════════════════════════════
     购物码功能
     ══════════════════════════════════════════════════════════════ */

  /* ── 生成购物码文本 ── */
  function generateCartCode() {
    if (cart.length === 0) return '';

    var lines = [];
    lines.push('【比奇堡报价单】');
    lines.push('');
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var subtotal = (item.price * item.quantity).toFixed(1);
      if (subtotal.indexOf('.0') === subtotal.length - 2) {
        subtotal = subtotal.slice(0, -2);
      }
      lines.push(item.name + ' ×' + item.quantity + '  (' + subtotal + '元)');
    }
    lines.push('');
    lines.push('总计：' + getCartTotal() + '元');
    return lines.join('\n');
  }

  /* ── 复制购物码到剪贴板 ── */
  function copyCartCode() {
    var code = generateCartCode();
    if (!code) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () {
        showCopyFeedback(true);
      }).catch(function () {
        fallbackCopy(code);
      });
    } else {
      fallbackCopy(code);
    }
  }

  /* ── 兼容旧浏览器的复制方式 ── */
  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopyFeedback(true);
    } catch (e) {
      showCopyFeedback(false);
    }
    document.body.removeChild(textarea);
  }

  /* ── 复制反馈 ── */
  function showCopyFeedback(success) {
    var btns = document.querySelectorAll('.cart-code-copy');
    for (var bi = 0; bi < btns.length; bi++) {
      (function (btn) {
        if (success) {
          btn.textContent = '✅ 已复制';
          btn.classList.add('copied');
        } else {
          btn.textContent = '❌ 复制失败';
        }
        setTimeout(function () {
          btn.textContent = '复制购物清单';
          btn.classList.remove('copied');
        }, 2000);
      })(btns[bi]);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════════ */
  function render() {
    if (!container) return;

    var folder = FOLDERS[currentCategory] || '';
    var list = ITEMS[currentCategory] || [];
    var html = '';

    // ── 左侧: 选项卡 + 头像 ──
    html += '<div class="cabinet-left-col">';
    html += '<div class="cabinet-category-tabs">';
    for (var ci = 0; ci < CATEGORIES.length; ci++) {
      var cat = CATEGORIES[ci];
      var active = (cat === currentCategory) ? ' cabinet-cat-active' : '';
      html += '<button class="cabinet-cat-tab' + active + '" data-cat="' + cat + '">' + cat + '</button>';
    }
    html += '</div>';

    // 头像
    html += '<div class="cabinet-left-avatars">';
    html += '<div class="cabinet-avatar-ball">' +
      '<div class="cabinet-avatar-icon"><img src="photo/biqibao/xielaoban.jpg" alt="蟹老板"></div>' +
      '<div class="cabinet-avatar-name">蟹老板</div>' +
      '<div class="cabinet-avatar-role">微信：Muyu1520i</div>' +
      '<button class="cabinet-avatar-copy" data-wx="Muyu1520i">复制微信号</button>' +
      '</div>';
    html += '<div class="cabinet-avatar-ball">' +
      '<div class="cabinet-avatar-icon"><img src="photo/biqibao/zhangyuge.jpg" alt="章鱼哥"></div>' +
      '<div class="cabinet-avatar-name">章鱼哥</div>' +
      '<div class="cabinet-avatar-role">微信：V19548181816</div>' +
      '<button class="cabinet-avatar-copy" data-wx="V19548181816">复制微信号</button>' +
      '</div>';
    html += '<div class="cabinet-avatar-ball">' +
      '<div class="cabinet-avatar-icon"><img src="photo/biqibao/suoche.jpg" alt="锁车"></div>' +
      '<div class="cabinet-avatar-name">锁车</div>' +
      '<div class="cabinet-avatar-role">微信：amr062021</div>' +
      '<button class="cabinet-avatar-copy" data-wx="amr062021">复制微信号</button>' +
      '</div>';
    html += '</div>';
    html += '</div>';

    // ── 右侧: 物资网格 ──
    html += '<div class="cabinet-content-area">';
    html += '<div class="maiwuzi-grid">';

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var imgPath = IMG_BASE + folder + '/' + item.img;
      var priceStr = (item.price !== null && item.price !== undefined) ? '' + item.price : '—';

      html += '<div class="maiwuzi-item">';
      html += '<div class="maiwuzi-item-pic">';
      html += '<img src="' + imgPath + '" alt="' + item.name + '" loading="lazy">';
      html += '<div class="maiwuzi-item-price"><span class="maiwuzi-price-value">' + priceStr + '</span></div>';
      html += '</div>';
      html += '<div class="maiwuzi-item-qty-row">';
      html += '<button class="maiwuzi-qty-btn maiwuzi-qty-minus" data-name="' + item.name.replace(/"/g, '&quot;') + '" data-price="' + item.price + '">−</button>';
      html += '<span class="maiwuzi-item-qty" data-name="' + item.name.replace(/"/g, '&quot;') + '">' + getItemQuantity(item.name) + '</span>';
      html += '<button class="maiwuzi-qty-btn maiwuzi-qty-plus" data-name="' + item.name.replace(/"/g, '&quot;') + '" data-price="' + item.price + '">+</button>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
    bindEvents();
  }

  /* ══════════════════════════════════════════════════════════════
     事件绑定
     ══════════════════════════════════════════════════════════════ */
  function bindEvents() {
    if (!container) return;

    // 品类切换
    var tabs = container.querySelectorAll('.cabinet-cat-tab');
    for (var ti = 0; ti < tabs.length; ti++) {
      tabs[ti].addEventListener('click', function () {
        currentCategory = this.getAttribute('data-cat');
        render();
      });
    }

    // 复制微信号
    var btns = container.querySelectorAll('.cabinet-avatar-copy');
    for (var bi = 0; bi < btns.length; bi++) {
      btns[bi].addEventListener('click', function () {
        var wx = this.getAttribute('data-wx');
        if (!wx) return;
        if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
          window.navigator.clipboard.writeText(wx).then(function (btn) {
            return function () {
              btn.textContent = '已复制！';
              btn.classList.add('copied');
              setTimeout(function () { btn.textContent = '复制微信号'; btn.classList.remove('copied'); }, 2000);
            };
          }(this)).catch(function () {
            fallbackCopy(wx);
          });
        } else {
          fallbackCopy(wx);
        }
      });
    }

    // ── 数量 [-] 按钮 ──
    var minusBtns = container.querySelectorAll('.maiwuzi-qty-minus');
    for (var mi = 0; mi < minusBtns.length; mi++) {
      minusBtns[mi].addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        if (!name) return;
        changeQuantity(name, -1);
      });
    }

    // ── 数量 [+] 按钮 ──
    var plusBtns = container.querySelectorAll('.maiwuzi-qty-plus');
    for (var pi = 0; pi < plusBtns.length; pi++) {
      plusBtns[pi].addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        var price = parseFloat(this.getAttribute('data-price'));
        if (!name || isNaN(price)) return;
        addToCart(name, price);
      });
    }
  }

  /* ── 复制降级 ── */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { alert('复制失败，请手动复制：' + text); }
    document.body.removeChild(ta);
  }

  /* ══════════════════════════════════════════════════════════════
     初始化
     ══════════════════════════════════════════════════════════════ */
  function init() {
    container = document.getElementById('maiwuziContent');
    if (!container) return;

    // ── 在框架下方创建购物车面板 ──
    var mainFrame = document.querySelector('.maiwuzi-main-frame');
    if (mainFrame) {
      var panelHtml =
        '<div class="cart-panel" id="cartPanel">' +
        '<div class="cart-panel-header" id="cartPanelHeader">' +
        '<span class="cart-panel-icon">🛒</span>' +
        '<span class="cart-panel-title">购物车</span>' +
        '<span class="cart-panel-summary" id="cartPanelSummary">0 件商品</span>' +
        '<div class="cart-panel-header-actions">' +
        '<button class="cart-code-copy" id="cartCodeCopy">复制购物清单</button>' +
        '<button class="cart-panel-clear" id="cartPanelClear">清空购物车</button>' +
        '</div>' +
        '<span class="cart-panel-total-label">总计：</span>' +
        '<span class="cart-panel-total" id="cartPanelTotal">0</span>' +
        '<span class="cart-panel-total-unit">元</span>' +
        '<span class="cart-panel-arrow" id="cartPanelArrow">▲</span>' +
        '</div>' +
        '<div class="cart-panel-body" id="cartPanelBody">' +
        '<div class="cart-body-top">' +
        '<span class="cart-body-top-total">总计：<span id="cartBodyTotal">0</span> 元</span>' +
        '<span class="cart-body-top-arrow">▼</span>' +
        '</div>' +
        '<div class="cart-panel-items" id="cartPanelItems"></div>' +
        '</div>' +
        '</div>';
      var panelDiv = document.createElement('div');
      panelDiv.innerHTML = panelHtml;
      mainFrame.appendChild(panelDiv.firstElementChild);
    }

    // ── 绑定购物车面板事件 ──
    var header = document.getElementById('cartPanelHeader');
    var clearBtn = document.getElementById('cartPanelClear');
    var copyBtn = document.getElementById('cartCodeCopy');
    var bodyTop = document.querySelector('.cart-body-top');

    if (header) header.addEventListener('click', toggleCartPanel);
    if (bodyTop) bodyTop.addEventListener('click', toggleCartPanel);

    function onClearClick(e) {
      e.stopPropagation();
      clearCart();
    }
    function onCopyClick(e) {
      e.stopPropagation();
      copyCartCode();
    }

    if (clearBtn) clearBtn.addEventListener('click', onClearClick);
    if (copyBtn) copyBtn.addEventListener('click', onCopyClick);

    render();
  }

  // DOM 加载完成后初始化
  if (document.readyState !== 'loading') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();