/* ============================================================
   kazhanbei.js — 鼠鼠卡战备主框架交互
   功能: 卡战备界面的交互逻辑 — 5个战备档位面板 + 装备详情展示
   数据来源: API 实时获取（Mode.SjzApi.battleV3ZB）
   [CREATED: 2026-06-09] [UPDATED: 2026-06-13]
   ============================================================ */

(function() {
  'use strict';

  /* ── 战备价值档位定义 ── */
  var BATTLE_TIERS = [
    { label: '11W', value: 110000, desc: '基础配置', lv: 0 },
    { label: '18W', value: 180000, desc: '中级配置', lv: 1 },
    { label: '55W', value: 550000, desc: '高级配置', lv: 2 },
    { label: '60W', value: 600000, desc: '顶级配置', lv: 3 },
    { label: '78W', value: 780000, desc: '毕业套装', lv: 5 },
  ];

  /* ── DOM 缓存 ── */
  var panelsEl = document.querySelector('.shushukazhanbei-panels');
  var panels = panelsEl ? panelsEl.querySelectorAll('.shushukazhanbei-panel') : [];
  var detailEl = document.getElementById('shushukazhanbeiBattleDetail');

  /* ── 状态 ── */
  var activeIndex = -1;        // 当前激活的面板索引
  var battleBuilds = null;     // 缓存的战备配装方案（全部5档位）
  var buildsLoading = false;   // 是否正在加载配装
  var buildsLoaded = false;    // 配装是否已加载完成


  /* ── 初始化 ── */
  function init() {
    if (!panels.length || !detailEl) {
      Mode.Debug.warn('Kazhanbei', 'DOM 元素缺失: panels=' + panels.length + ', detail=' + !!detailEl);
      return;
    }

    Mode.Debug.log('Kazhanbei', '鼠鼠卡战备模块初始化...');

    // 绑定面板点击事件
    panels.forEach(function(panel, index) {
      panel.addEventListener('click', function() {
        onPanelClick(index);
      });
    });

    // 预先加载战备配装方案（一次获取全部5档位）
    fetchBattleBuilds();

    // 默认打开11W档位（第1个面板）
    setTimeout(function() {
      onPanelClick(0);
    }, 150);
  }

  /* ── 从 API 获取全部卡战备方案（V3，已过滤兑换组+排序取前10）── */
  function fetchBattleBuilds() {
    if (buildsLoading || buildsLoaded) return;
    buildsLoading = true;

    Mode.Debug.log('Kazhanbei', '🚀 开始加载战备数据（V3，已过滤兑换组+排序取前10）...');

    var fetchFn = Mode.SjzApi && (typeof Mode.SjzApi.battleV4ZB === 'function' ? Mode.SjzApi.battleV4ZB : Mode.SjzApi.battleV3ZB);

    if (fetchFn) {
      fetchFn().then(function(data) {
        battleBuilds = data || {};
        buildsLoaded = true;
        buildsLoading = false;
        var keys = Object.keys(battleBuilds);
        Mode.Debug.log('Kazhanbei', '✅ 战备V3 数据加载完成，根键名: [' + keys.join(', ') + ']');
        // 打印前两个键的数据结构预览
        if (keys.length > 0) {
          var firstKey = keys[0];
          var firstVal = battleBuilds[firstKey];
          Mode.Debug.log('Kazhanbei', '🔍 键 "' + firstKey + '" 的数据类型: ' + typeof firstVal + ', 预览: ' + JSON.stringify(firstVal).slice(0, 500));
        }
        if (keys.length > 1) {
          var secondKey = keys[1];
          var secondVal = battleBuilds[secondKey];
          Mode.Debug.log('Kazhanbei', '🔍 键 "' + secondKey + '" 的数据类型: ' + typeof secondVal + ', 预览: ' + JSON.stringify(secondVal).slice(0, 500));
        }
        
        // 如果当前有活跃面板，重新渲染
        if (activeIndex >= 0 && panels[activeIndex]) {
          renderBuildForTier(activeIndex);
        }
      }).catch(function(err) {
        Mode.Debug.warn('Kazhanbei', '战备加载失败: ' + (err.message || err));
        buildsLoaded = true;
        buildsLoading = false;
        battleBuilds = {};
      });
    } else {
      Mode.Debug.warn('Kazhanbei', '战备 API 不可用');
      buildsLoaded = true;
      buildsLoading = false;
      battleBuilds = {};
    }
  }

  /* ── 面板点击处理 ── */
  function onPanelClick(index) {
    Mode.Debug.log('Kazhanbei', '>>> onPanelClick, index=' + index + ', activeIndex=' + activeIndex);

    // 切换到新面板
    panels.forEach(function(p) { p.classList.remove('active'); });
    panels[index].classList.add('active');
    activeIndex = index;
    detailEl.style.display = '';

    // 渲染该档位的配装方案
    renderBuildForTier(index);
  }

  /* ── 渲染档位对应的配装方案 ── */
  function renderBuildForTier(index) {
    Mode.Debug.log('Kazhanbei', '>>> renderBuildForTier, index=' + index);
    var tier = BATTLE_TIERS[index];
    if (!tier) return;

    // 数据正在加载中
    if (buildsLoading && !buildsLoaded) {
      detailEl.innerHTML = '<div class="shushukazhanbei-loading">正在加载战备数据...</div>';
      detailEl.style.display = 'flex';
      return;
    }

    // 从预加载的数据中获取对应档位
    var lv = tier.lv;
    var tierData = battleBuilds && battleBuilds[lv];

    if (!tierData) {
      Mode.Debug.warn('Kazhanbei', '档位 ' + tier.label + ' (lv=' + lv + ') 无数据');
      showEmpty(tier.label);
      return;
    }

    // 调试：打印数据结构预览
    Mode.Debug.log('Kazhanbei', '🔍 lv=' + lv + ' 数据结构: ' + JSON.stringify(tierData).slice(0, 300));

    // 获取配装数据 - 兼容 V3-ZB / V3+ 不同格式
    // V3-ZB格式: {data: [{name, jz, data:[items]}, ...]}
    // V3+格式:   {data: [{list: [...]}]}
    // V3格式:    {list: [...]} 或 [{...}, {...}]
    var tierDataRaw = tierData;
    var buildList = null;
    
    // 检查空数据：{data: []} → 直接显示空状态，避免后续错误解析
    if (tierData.data && Array.isArray(tierData.data)) {
      if (tierData.data.length === 0) {
        Mode.Debug.warn('Kazhanbei', '档位 ' + tier.label + ' (lv=' + lv + ') 数据为空数组');
        showEmpty(tier.label);
        return;
      }
      var firstItem = tierData.data[0];
      // 判断是否是 V3-ZB 格式（build 对象有 name/jz/data 字段）
      if (firstItem && firstItem.name && (firstItem.jz !== undefined || Array.isArray(firstItem.data))) {
        // V3-ZB 格式：data 数组就是配装列表
        buildList = { list: tierData.data };
      } else {
        // V3+ 格式：进一步解包
        tierDataRaw = tierData.data[0];
      }
    }
    
    if (!buildList) {
      // 解析配装列表（非 V3-ZB 格式）
      if (tierDataRaw && tierDataRaw.list && Array.isArray(tierDataRaw.list)) {
        // 格式1: { list: [...] }
        buildList = tierDataRaw;
      } else if (Array.isArray(tierDataRaw) && tierDataRaw.length > 0 && tierDataRaw[0].list) {
        // 格式2: [{ list: [...] }]
        buildList = tierDataRaw[0];
      } else if (Array.isArray(tierDataRaw) && tierDataRaw.length > 0) {
        // 格式3: [item1, item2, ...] - 每个 item 就是一个方案
        buildList = { list: tierDataRaw };
      }
    }
    
    if (!buildList || !buildList.list || !Array.isArray(buildList.list)) {
      Mode.Debug.warn('Kazhanbei', '档位 ' + tier.label + ' 配装列表解析失败');
      showEmpty(tier.label);
      return;
    }

    // 处理每个配装方案
    var allBuilds = buildList.list.map(function(listItem, idx) {
      var totalJz = 0;
      var totalPrice = 0;
      var allItems = [];
      
      if (listItem.data && Array.isArray(listItem.data)) {
        listItem.data.forEach(function(item) {
          totalJz += item.jz || 0;
          totalPrice += item.price || 0;
          allItems.push(item);
        });
      }
      
      return {
        index: idx + 1,
        cz: listItem.cz || 0,
        jz: listItem.jz || totalJz,
        totalPrice: listItem.price || totalPrice,
        data: allItems,
        name: listItem.name || '配装方案'
      };
    });

    Mode.Debug.log('Kazhanbei', '档位 ' + tier.label + ' 共有 ' + allBuilds.length + ' 个配装方案');

    // 渲染所有配装方案
    renderAllBuilds(allBuilds, tier.label);
  }

  /* ── 渲染所有配装方案 ── */
  function renderAllBuilds(builds, tierLabel) {
    if (!builds || builds.length === 0) {
      showEmpty(tierLabel);
      return;
    }

    // 显示所有方案（最多3个）
    var topBuilds = builds.slice(0, 3);
    
    var html = '<div class="shushukazhanbei-three-col">';
    
    // 三栏同时显示：左(枪械优先) | 中(均衡套装) | 右(胸挂优先)
    topBuilds.forEach(function(build, idx) {
      html += '<div class="shushukazhanbei-col-card">';
      // 用 API 返回的 build.name 作为标题
      html += buildSingleBuildHTML(build, tierLabel);
      html += '</div>';
    });
    
    html += '</div>';
    
    detailEl.innerHTML = html;
    detailEl.style.display = 'flex';
  }

  /* ── 渲染单个配装方案（带方案标题）── */
  function buildSingleBuildHTML(build, tierLabel) {
    var items = extractBuildItems(build);
    
    // ── 按 slot 排序（统一顺序：武器→配件→头盔→护甲→胸挂→背包）──
    var slotPriority = { weapon: 1, acc: 2, helmet: 3, armor: 4, chest: 5, bag: 6 };
    items = items.slice().sort(function(a, b) {
      return (slotPriority[a.slot] || 99) - (slotPriority[b.slot] || 99);
    });
    
    // ── 统计值 ──
    var totalPrice = 0;
    items.forEach(function(item) {
      totalPrice += item.price || 0;
    });
    // 战备价值：直接用 API 返回的 build.jz（战备系统估值）
    var battleValue = build.jz || totalPrice;
    // 假账：用 API 返回的 cz，若没有则计算差值
    var fakeProfit = (build.cz !== undefined ? build.cz : (totalPrice - battleValue));
    
    var html = '<div class="shushukazhanbei-equipment-card">';
    
    // ── 方案名称标题 ──
    html += '<div class="shushukazhanbei-build-title" style="font-size:clamp(1rem,3vw,1.6rem);font-weight:bold;color:#f5b82e;text-shadow:0 0 8px rgba(245,184,46,0.3);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(245,184,46,0.2);text-align:center;">';
    html += escapeHtml(build.name || '配装方案');
    html += '</div>';
    
    // ── 3个统计值 ──
    html += '<div class="shushukazhanbei-stats-row">';
    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">预估花费</span>';
    html += '    <span class="shushukazhanbei-stat-value">' + Mode.formatCurrency(totalPrice) + '</span>';
    html += '  </div>';
    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">战备价值</span>';
    html += '    <span class="shushukazhanbei-stat-value" style="color: #4ade80">' + Mode.formatCurrency(battleValue) + '</span>';
    html += '  </div>';
    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">估算假账</span>';
    html += '    <span class="shushukazhanbei-stat-value" style="color: #f87171">' + Mode.formatCurrency(fakeProfit) + '</span>';
    html += '  </div>';
    html += '</div>';
    
    // ── 装备列表（使用已有CSS类的三栏布局：图片→名称(居中)→价值）──
    html += '<div class="shushukazhanbei-equipment-list">';
    items.forEach(function(item) {
      if (!item.price || item.price <= 0) return;
      if (!item.name || item.name === '未知装备') return;
      var imgSrc = item.pic || '';
      html += '<div class="shushukazhanbei-equipment-item">';
      html += '  <div class="shushukazhanbei-equipment-img-wrap">';
      if (imgSrc) {
        html += '    <img class="shushukazhanbei-equipment-img" src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
      }
      html += '  </div>';
      html += '  <div class="shushukazhanbei-equipment-info">';
      html += '    <span class="shushukazhanbei-equip-name">' + escapeHtml(item.name) + '</span>';
      html += '  </div>';
      html += '  <div class="shushukazhanbei-equipment-value">' + Mode.formatCurrency(item.price) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    
    html += '</div>';
    return html;
  }

  /* ── 渲染配装数据（旧版，兼容）── */
  function renderBuild(build, label) {
    var items = extractBuildItems(build);
    var totalPrice = extractBuildTotalPrice(build);
    var battleValue = build.jz || build.battleValue || build.totalBattleValue || totalPrice;

    if (items && items.length > 0) {
      Mode.Debug.log('Kazhanbei', '渲染配装: ' + label + ', 物品: ' + items.length + ' 件');
      var html = buildItemListHTML(items, label, totalPrice, battleValue);
      detailEl.innerHTML = html;
      detailEl.style.display = 'flex';
    } else {
      showEmpty(label);
    }
  }

  /* ── 显示空状态 ── */
  function showEmpty(label) {
    detailEl.innerHTML = '<div class="shushukazhanbei-empty-state">暂无 ' + label + ' 档位配装数据</div>';
    detailEl.style.display = 'flex';
  }




  /* ── Type → Slot 映射（API type字段 → 渲染slot）── */
  function mapTypeToSlot(type) {
    if (!type) return 'acc';
    var t = String(type);
    // 纯"枪"或"枪N"(N为数字) → 武器；"枪N-xxx" → 配件
    if (/^枪\d*$/.test(t)) return 'weapon';
    if (/枪/.test(t)) return 'acc';
    if (/护甲|防弹衣/.test(t)) return 'armor';
    if (/头盔|头/.test(t)) return 'helmet';
    if (/胸挂|弹挂/.test(t)) return 'chest';
    if (/背包|包/.test(t)) return 'bag';
    if (/瞄具|枪口|握把|镭指|消音|配件/.test(t)) return 'acc';
    if (/弹药|子弹/.test(t)) return 'ammo';
    return 'acc';
  }

  /* ── Type → Category 中文（API type字段 → 显示文字）── */
  function mapTypeToCategory(type) {
    if (!type) return '配件';
    var t = String(type).replace(/\d+/g, '').replace(/[-—].*/, '');
    if (/^枪械?$/.test(t)) return '主武器';
    return t || '配件';
  }

  /* ── 提取配装总价值（兼容多种字段名）── */
  function extractBuildTotalPrice(build) {
    return build.totalPrice || build.total_price || build.totalvalue || build.value || build.price || build.total || 0;
  }

  /* ── 提取配装物品列表（兼容 API 与本地数据）── */
  function extractBuildItems(build) {
    var raw = build.data || build.items || build.equipment || build.equip || build.gear || build.details || [];
    return raw.map(function(item) {
      // 构造图片URL（API 返回的 pic 可能带反引号，需要去掉）
      var imgUrl = (item.pic || item.icon || item.iconUrl || item.image || '').replace(/^`+|`+$/g, '');
      return {
        name: item.name || item.itemName || item.objectName || item.item_name || '未知装备',
        price: item.price || item.value || item.itemPrice || item.item_price || 0,
        objectID: item.objectID || item.objectId || item.object_id || 0,
        pic: imgUrl,
        grade: item.grade || 0,
        slot: mapTypeToSlot(item.type || item.slot || item.category || item.secondClassCN || ''),
        category: mapTypeToCategory(item.type || item.slot || item.category || item.secondClassCN || item.primaryClass || ''),
        exchange: item.exchange || '',
        exchange_plus: item.exchange_plus || null,
        jz: item.jz || 0,
        bl: item.bl || 0,
        purchaseCount: item.purchaseCount || item.purchase_count || '',
        purchaseDuration: item.purchaseDuration || item.purchase_duration || '',
        countsTowardBV: true
      };
    });
  }

  /* ── 生成物品清单 HTML（3统计值 + 物品行）── */
  function buildItemListHTML(items, tierLabel, totalCost, battleValue) {
    // 假账 = 战备价值 - 实际花费（正=赚，负=亏）
    var fakeProfit = battleValue - totalCost;

    var html = '<div class="shushukazhanbei-equipment-card">';

    // ── 档位标题 ──
    html += '<div class="shushukazhanbei-build-title">' + escapeHtml(tierLabel) + ' 战备配装方案</div>';

    // ── 3 个统计值 ──
    html += '<div class="shushukazhanbei-stats-row">';

    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">预估花费</span>';
    html += '    <span class="shushukazhanbei-stat-value">' + Mode.formatCurrency(totalCost) + '</span>';
    html += '  </div>';

    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">估算战备</span>';
    html += '    <span class="shushukazhanbei-stat-value">' + Mode.formatCurrency(battleValue) + '</span>';
    html += '  </div>';

    var profitClass = fakeProfit >= 0 ? ' profit' : ' loss';
    var profitSign = fakeProfit >= 0 ? '+' : '';
    html += '  <div class="shushukazhanbei-stat-box">';
    html += '    <span class="shushukazhanbei-stat-label">估算假账</span>';
    html += '    <span class="shushukazhanbei-stat-value' + profitClass + '">' + profitSign + Mode.formatCurrency(fakeProfit) + '</span>';
    html += '  </div>';

    html += '</div>';

    // ── 物品清单 ──
    html += '<div class="shushukazhanbei-equipment-list">';

    // 按指定优先级排序：武器 → 配件 → 头 → 甲 → 胸挂 → 背包
    var slotPriority = {
      weapon: 1,
      acc: 2,
      helmet: 3,
      armor: 4,
      chest: 5,
      bag: 6
    };
    items = items.slice().sort(function(a, b) {
      var pa = slotPriority[a.slot] || 99;
      var pb = slotPriority[b.slot] || 99;
      return pa - pb;
    });

    items.forEach(function(item) {
      // 跳过价格无效或名称未知的条目
      if (!item.price || item.price <= 0) return;
      if (!item.name || item.name === '未知装备') return;
      var extraClass = '';
      if (item.slot === 'weapon') extraClass = ' main-weapon';
      // 物品图片URL（直接使用API返回的 pic 字段，不设CDN兜底）
      var imgSrc = item.pic || '';
      html += '<div class="shushukazhanbei-equipment-item' + extraClass + '">';
      html += '  <div class="shushukazhanbei-equipment-img-wrap">';
      if (imgSrc) {
        html += '    <img class="shushukazhanbei-equipment-img" src="' + escapeHtml(imgSrc) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
      }
      html += '  </div>';
      html += '  <div class="shushukazhanbei-equipment-info">';
      html += '    <span class="shushukazhanbei-equip-name">' + escapeHtml(item.name) + '</span>';
      html += '  </div>';
      html += '  <div class="shushukazhanbei-equipment-value">' + Mode.formatCurrency(item.price) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }



  /* ── HTML 转义（防 XSS）── */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── 暴露到 Mode 命名空间（含 refresh 方法，用于缓存刷新后重新加载）── */
  Mode.Kazhanbei = {
    init: init,
    refresh: function() {
      // 重置内部缓存标记，允许重新请求
      buildsLoaded = false;
      buildsLoading = false;
      battleBuilds = null;
      // 清空活跃面板，触发重新渲染
      activeIndex = -1;
      // 重新初始化
      init();
    }
  };

  /* ── 自动初始化 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();