/**
 * orders.js — AWM回收订单管理模块
 * 功能：管理员登录、订单增删改查
 */
const AwmOrders = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    debugTag: 'AwmOrders',
    apiUrl: '/.netlify/functions/orders',
  };

  /* ── 内部状态 ── */
  let isAdminLoggedIn = false;
  let adminPassword = '';
  let currentOrders = [];
  let editingId = null;

  /* ── API 地址 ── */
  function getApiUrl() {
    var isLocal = window.location.protocol === 'file:' ||
                  window.location.hostname === '' ||
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';
    return isLocal ? '/netlify/functions/orders' : '/.netlify/functions/orders';
  }

  /* ── HTML 转义 ── */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ── 格式化时间 ── */
  function formatTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min + ':' + s;
  }

  /* ── 生成订单号（B+月日时分） ── */
  function generateOrderNumber() {
    var now = new Date();
    var y = String(now.getFullYear()).slice(2);
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var h = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    return 'B' + y + m + d + h + min + s;
  }

  /* ── 获取容器 ── */
  function getContainer() {
    return document.getElementById('awmOrdersSlot');
  }

  /* ── 渲染管理界面 ── */
  function render() {
    var container = getContainer();
    if (!container) return;

    if (!isAdminLoggedIn) {
      renderPublicView(container);
    } else {
      renderAdminPanel(container);
    }
  }

  /* ── 更新标题统计信息 ── */
  function updateTitleStats() {
    var titleEl = document.getElementById('ordersTitleStats');
    if (!titleEl || !currentOrders) return;
    
    var totalAmount = 0;
    for (var i = 0; i < currentOrders.length; i++) {
      totalAmount += Number(currentOrders[i].total_price || currentOrders[i].amount || 0);
    }
    titleEl.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.4);">（共 ' + currentOrders.length + ' 条）💰 累计：¥' + totalAmount.toFixed(2) + '</span>';
  }

  /* ── 渲染公开视图（所有人可见） ── */
  function renderPublicView(container) {
    container.innerHTML = `
      <div class="guanyu-card">
        <div class="guanyu-card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span>♻️ 回收AW <span id="ordersTitleStats" style="font-size:12px;color:rgba(255,255,255,0.4);">（加载中...）</span></span>
          <button id="ordersLoginShowBtn" class="admin-toggle-btn" style="flex-shrink:0;">🔧 管理员登录</button>
        </div>
        <div id="ordersLoginPanel" class="admin-panel" style="display:none;">
          <div class="admin-panel-title">🔐 管理员登录</div>
          <div class="admin-row" style="display:flex;gap:10px;flex-wrap:wrap;">
            <input type="password" id="ordersLoginPass" placeholder="请输入管理员密码" class="admin-input" style="flex:1;min-width:120px;">
            <button id="ordersLoginBtn" class="admin-submit-btn">登录</button>
          </div>
          <div id="ordersLoginStatus" class="admin-status" style="color:#ff6b6b;"></div>
        </div>
        <div class="guanyu-card-text" style="padding:4px;">
          <div style="margin-bottom:12px;">
            <input id="ordersPublicSearch" type="text" placeholder="🔍 输入订单号搜索..." class="admin-input" style="width:100%;box-sizing:border-box;">
          </div>
          <div id="ordersPublicCards" class="hide-scrollbar" style="max-height:55vh;overflow-y:auto;"></div>
        </div>
      </div>
    `;

    loadOrders(true);

    document.getElementById('ordersPublicCards').addEventListener('click', function(e) {
      var el = e.target.closest('.copy-btn-order');
      if (el) copyOrderNumber(el.dataset.order, el);
    });

    document.getElementById('ordersPublicSearch').addEventListener('input', function() {
      var keyword = this.value.trim().toLowerCase();
      var cards = document.querySelectorAll('#ordersPublicCards .guanyu-card');
      cards.forEach(function(card) {
        var orderText = (card.dataset.order || '').toLowerCase();
        card.style.display = orderText.indexOf(keyword) !== -1 ? '' : 'none';
      });
    });

    document.getElementById('ordersLoginShowBtn').addEventListener('click', function() {
      var panel = document.getElementById('ordersLoginPanel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('ordersLoginBtn').addEventListener('click', doLogin);
    document.getElementById('ordersLoginPass').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') doLogin();
    });
  }

  /* ── 渲染登录表单 ── */
  function renderLoginForm(container) {
    container.innerHTML = `
      <div class="guanyu-card">
        <div class="guanyu-card-title">♻️ 回收AW <span style="font-size:12px;color:rgba(255,255,255,0.4);">（管理员登录）</span></div>
        <div class="admin-panel" style="margin-top:4px;">
          <div class="admin-panel-title">🔐 管理员登录</div>
          <div class="admin-row" style="flex-direction:column;gap:10px;">
            <input type="password" id="ordersLoginPass" placeholder="请输入管理员密码" class="admin-input" style="text-align:center;">
            <div id="ordersLoginStatus" class="admin-status" style="color:#ff6b6b;"></div>
            <button id="ordersLoginBtn" class="admin-submit-btn" style="width:100%;">登录</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ordersLoginBtn').addEventListener('click', doLogin);
    document.getElementById('ordersLoginPass').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') doLogin();
    });
  }

  /* ── 渲染管理面板 ── */
  function renderAdminPanel(container) {
    // 计算统计信息
    var totalAmount = 0;
    for (var i = 0; i < currentOrders.length; i++) {
      totalAmount += Number(currentOrders[i].total_price || 0);
    }
    
    var html = `
      <div class="guanyu-card">
        <div class="guanyu-card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <span>♻️ 回收AW <span style="font-size:12px;color:rgba(255,255,255,0.4);">（共 ${currentOrders.length} 条）💰 累计：¥${totalAmount.toFixed(2)}</span></span>
          <button id="ordersLogoutBtn" class="admin-toggle-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;flex-shrink:0;">🔐 退出管理</button>
        </div>

        <!-- 搜索框 -->
        <div style="margin-bottom:12px;padding:0 4px;">
          <input type="text" id="ordersSearch" placeholder="🔍 搜索订单号..." class="admin-input" style="width:100%;box-sizing:border-box;">
        </div>

        <!-- 添加订单表单 -->
        ${renderAddForm()}

        <!-- 订单表格 -->
        <div id="ordersTableContainer"></div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('ordersLogoutBtn').addEventListener('click', doLogout);
    document.getElementById('ordersSearch').addEventListener('input', handleSearch);
    document.getElementById('ordersAddBtn').addEventListener('click', doAddOrder);
    document.getElementById('ordersTableContainer').addEventListener('click', handleTableAction);
    // 编辑模式自动计算价格
    document.getElementById('ordersTableContainer').addEventListener('input', function(e) {
      if (e.target.classList.contains('edit-bullets') || e.target.classList.contains('edit-price')) {
        var row = e.target.closest('tr');
        if (!row) return;
        var bulletsInput = row.querySelector('.edit-bullets');
        var priceInput = row.querySelector('.edit-price');
        var typeSelect = row.querySelector('.edit-type');
        if (!bulletsInput || !priceInput) return;
        var qty = parseInt(bulletsInput.value) || 0;
        var isDashang = typeSelect && typeSelect.value === '打手上号';
        var pricePerBullet = isDashang ? 0.55 : 0.5;
        priceInput.value = (qty * pricePerBullet).toFixed(2);
      }
    });

    // 未结单/已结单互斥
    var addUnsettled = document.getElementById('ordersAddUnsettled');
    var addSettledCB = document.getElementById('ordersAddSettled');
    if (addUnsettled && addSettledCB) {
      addUnsettled.addEventListener('change', function() {
        if (this.checked) addSettledCB.checked = false;
      });
      addSettledCB.addEventListener('change', function() {
        if (this.checked) addUnsettled.checked = false;
      });
    }

    // 客户类型按钮切换
    var dashangBtn = document.getElementById('ordersTypeDashang');
    var zijiBtn = document.getElementById('ordersTypeZiji');
    if (dashangBtn && zijiBtn) {
      function setOrderType(type) {
        if (type === 'dashang') {
          dashangBtn.innerHTML = '✅ 打手上号';
          dashangBtn.style.background = 'rgba(74,222,128,0.15)';
          dashangBtn.style.color = '#4ade80';
          dashangBtn.style.border = '1px solid rgba(74,222,128,0.3)';
          dashangBtn.style.fontWeight = '600';
          zijiBtn.innerHTML = '自己跟车<br><span style="font-size:11px;font-weight:400;">(0.5/发)</span>';
          zijiBtn.style.background = 'rgba(255,255,255,0.05)';
          zijiBtn.style.color = 'rgba(255,255,255,0.5)';
          zijiBtn.style.border = '1px solid rgba(255,255,255,0.1)';
          zijiBtn.style.fontWeight = '400';
        } else {
          zijiBtn.innerHTML = '✅ 自己跟车<br><span style="font-size:11px;font-weight:400;">(0.5/发)</span>';
          zijiBtn.style.background = 'rgba(74,222,128,0.15)';
          zijiBtn.style.color = '#4ade80';
          zijiBtn.style.border = '1px solid rgba(74,222,128,0.3)';
          zijiBtn.style.fontWeight = '600';
          dashangBtn.innerHTML = '打手上号<br><span style="font-size:11px;font-weight:400;">(0.55/发)</span>';
          dashangBtn.style.background = 'rgba(255,255,255,0.05)';
          dashangBtn.style.color = 'rgba(255,255,255,0.5)';
          dashangBtn.style.border = '1px solid rgba(255,255,255,0.1)';
          dashangBtn.style.fontWeight = '400';
        }
        autoCalcPrice();
      }
      dashangBtn.addEventListener('click', function() { setOrderType('dashang'); });
      zijiBtn.addEventListener('click', function() { setOrderType('ziji'); });
    }

    // 子弹数量输入自动计算总价
    document.getElementById('ordersAddBullets').addEventListener('input', autoCalcPrice);

    loadOrders();
  }

  /* ── 自动计算总价 ── */
  function autoCalcPrice() {
    var dashangBtn = document.getElementById('ordersTypeDashang');
    var bullets = parseInt(document.getElementById('ordersAddBullets').value);
    var priceInput = document.getElementById('ordersAddPrice');
    if (!bullets || bullets <= 0 || !priceInput) {
      if (priceInput) priceInput.value = '';
      return;
    }
    var isDashang = dashangBtn && dashangBtn.style.fontWeight === '600';
    var pricePerBullet = isDashang ? 0.55 : 0.5;
    priceInput.value = (bullets * pricePerBullet).toFixed(2);
  }

  /* ── 渲染添加表单 ── */
  function renderAddForm() {
    var now = new Date();
    var defaultTime = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + 'T' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    return `
      <div class="admin-add-form admin-panel" style="margin-top:0;margin-bottom:12px;">
        <div class="admin-panel-title">➕ 添加新订单</div>
        <!-- Row 1: 订单号 -->
        <div class="admin-row" style="margin-bottom:10px;">
          <input type="text" id="ordersAddOrderNum" class="admin-input" readonly
            value="${generateOrderNumber()}"
            title="规则: B + 月月 + 日日 + 时时 + 分分，如 B06110855"
            style="color:rgba(255,255,255,0.5);width:100%;box-sizing:border-box;">
        </div>
        <!-- Row 2-3: 2列网格 — 客户类型(左) | 子弹数量/总价(右) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <!-- 左列：客户类型 -->
          <div style="display:flex;flex-direction:column;">
            <label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:6px;">客户类型</label>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <button id="ordersTypeDashang" class="admin-input" style="padding:8px;cursor:pointer;text-align:center;background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);font-weight:600;">✅ 打手上号</button>
              <button id="ordersTypeZiji" class="admin-input" style="padding:8px;cursor:pointer;text-align:center;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);font-weight:400;">自己跟车<br><span style="font-size:11px;font-weight:400;">(0.5/发)</span></button>
            </div>
          </div>
          <!-- 右列：子弹数量 + 总价 -->
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;flex-direction:column;">
              <label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:4px;">子弹数量（发）</label>
              <input type="number" id="ordersAddBullets" placeholder="输入数量" min="1" class="admin-input">
            </div>
            <div style="display:flex;flex-direction:column;">
              <label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:4px;">总价（元）</label>
              <input type="number" id="ordersAddPrice" placeholder="自动计算" step="0.01" min="0" class="admin-input" readonly style="color:#4ade80;font-weight:600;">
            </div>
          </div>
        </div>
        <!-- Row 4: 创建时间 -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <label style="color:rgba(255,255,255,0.5);font-size:12px;white-space:nowrap;">创建时间：</label>
          <input type="datetime-local" id="ordersAddTime" value="${defaultTime}" class="admin-input" style="flex:1;padding:6px 10px;font-size:12px;">
          <label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" id="ordersAddUseNow" checked style="cursor:pointer;"> 使用当前时间
          </label>
        </div>
        <!-- Row 5: 未结单/已结单 + 添加按钮 -->
        <div style="display:flex;align-items:center;gap:12px;">
          <label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;">
            <input type="checkbox" id="ordersAddUnsettled" checked style="cursor:pointer;width:16px;height:16px;"> 未结单</label>
          <label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;">
            <input type="checkbox" id="ordersAddSettled" style="cursor:pointer;width:16px;height:16px;"> 已结单</label>
          <div style="flex:1;"></div>
          <button id="ordersAddBtn" class="admin-submit-btn">📝 添加订单</button>
        </div>
      </div>
    `;
  }

  /* ── 渲染订单卡片（公开视图，12345布局） ── */
  function renderOrderCards(orders) {
    var container = document.getElementById('ordersPublicCards');
    if (!container) return;

    // 修复：处理可能的数组格式问题
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);">暂无订单记录</div>';
      return;
    }

    var html = '<div class="guanyu-card-text" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px;padding:0;">';
    for (var i = 0; i < orders.length; i++) {
      var d = orders[i];
      // 修复：处理数据字段可能为null/undefined或字符串类型的问题
      var customerType = escapeHtml(d.customer_type || d.type || '打手上号');
      var bulletCount = parseInt(d.bullet_count || d.bullets || d.count || '0', 10) || 0;
      var totalPrice = parseFloat(d.total_price || d.amount || d.price || '0').toFixed(2);
      var orderNum = escapeHtml(d.order_number || d.order_num || d.number || '');
      var timeStr = formatTime(d.created_at || d.time || d.created);

      html += '<div class="guanyu-card" style="min-height:140px;display:flex;flex-direction:column;padding:12px;" data-order="' + orderNum + '">';
      // ① 客户类型
      html += '<div style="font-size:13px;color:#5bc0de;font-weight:600;text-align:center;flex-shrink:0;">' + customerType + '</div>';
      // ② 子弹数量
      html += '<div style="font-size:16px;color:#f5b82e;font-weight:700;text-align:center;margin-top:6px;flex-shrink:0;">🔫 ' + bulletCount + ' 发</div>';
      // ③ 总价
      html += '<div style="font-size:18px;color:#4ade80;font-weight:700;text-align:center;margin-top:4px;flex-shrink:0;">¥' + totalPrice + '</div>';
      // ④ 订单号 + 复制按钮
      html += '<div style="text-align:center;margin-top:8px;flex-shrink:0;">';
      if (orderNum) {
        html += '<span style="font-size:11px;color:rgba(255,255,255,0.4);">#' + orderNum + '</span>';
        html += ' <button class="copy-btn-order" data-order="' + orderNum + '" style="background:rgba(245,184,46,0.15);color:#f5b82e;border:none;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;vertical-align:middle;">📋复制</button>';
      }
      html += '</div>';
      // ⑤ 状态（已结/未结）
      html += '<div style="text-align:center;margin-top:6px;flex-shrink:0;">';
      html += '<span style="display:inline-block;font-size:11px;padding:1px 8px;border-radius:4px;' + (d.settled ? 'background:rgba(74,222,128,0.15);color:#4ade80;' : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);') + '">' + (d.settled ? '🟢 已结' : '🟡 未结') + '</span>';
      html += '</div>';
      // ⑥ 时间
      if (timeStr) {
        html += '<div style="font-size:11px;color:rgba(255,255,255,0.35);text-align:center;margin-top:auto;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.08);flex-shrink:0;">🕐' + timeStr + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ── 渲染订单表格 ── */
  function renderOrdersTable(orders, readOnly) {
    var container = document.getElementById('ordersTableContainer') || document.getElementById('ordersPublicTable');
    if (!container) return;

    // 修复：处理可能的数组格式问题
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);">暂无订单记录</div>';
      return;
    }

    var html = '<div class="admin-table-wrapper hide-scrollbar" style="max-height:55vh;overflow-y:auto;"><table class="admin-table">';
    html += '<thead><tr>';
    html += '<th>订单号</th>';
    html += '<th>客户类型</th>';
    html += '<th>子弹数量</th>';
    html += '<th>总价</th>';
    html += '<th>状态</th>';
    html += '<th>时间</th>';
    if (!readOnly) {
      html += '<th style="text-align:center;">操作</th>';
    }
    html += '</tr></thead><tbody>';

    orders.forEach(function(order) {
      var isEditing = editingId === order.id;
      html += '<tr data-id="' + order.id + '">';

      if (isEditing && !readOnly) {
        html += '<td style="color:rgba(255,255,255,0.5);font-size:11px;">' + escapeHtml(order.order_number || '') + '</td>';
        html += '<td><select class="edit-type admin-input" style="padding:4px 8px;font-size:12px;width:100%;">';
        html += '<option value="打手上号"' + (order.customer_type === '打手上号' ? ' selected' : '') + '>打手上号</option>';
        html += '<option value="自己跟车"' + (order.customer_type === '自己跟车' ? ' selected' : '') + '>自己跟车</option>';
        html += '</select></td>';
        html += '<td><input type="number" class="edit-bullets admin-input" value="' + order.bullet_count + '" min="1" style="width:100%;padding:4px 8px;font-size:12px;box-sizing:border-box;"></td>';
        html += '<td><input type="number" class="edit-price admin-input" value="' + order.total_price + '" step="0.01" min="0" style="width:100%;padding:4px 8px;font-size:12px;box-sizing:border-box;"></td>';
        html += '<td><select class="edit-settled admin-input" style="padding:4px 8px;font-size:12px;">';
        html += '<option value="0"' + (order.settled ? '' : ' selected') + '>🟡 未结</option>';
        html += '<option value="1"' + (order.settled ? ' selected' : '') + '>🟢 已结</option>';
        html += '</select></td>';
        html += '<td style="color:rgba(255,255,255,0.5);font-size:12px;">' + formatTime(order.created_at) + '</td>';
        html += '<td class="awm-actions">';
        html += '<button class="btn-save awm-save-btn" style="padding:4px 12px;font-size:12px;margin-right:4px;">保存</button>';
        html += '<button class="btn-cancel awm-cancel-btn" style="padding:4px 12px;font-size:12px;">取消</button>';
        html += '</td>';
      } else {
        html += '<td style="color:rgba(255,255,255,0.5);font-size:11px;">' + escapeHtml(order.order_number || '-') + ' <button class="copy-btn-order" data-order="' + escapeHtml(order.order_number || '') + '" style="background:rgba(245,184,46,0.15);color:#f5b82e;border:none;padding:1px 6px;border-radius:3px;cursor:pointer;font-size:10px;vertical-align:middle;">📋</button></td>';
        html += '<td style="color:#d4c8a8;">' + escapeHtml(order.customer_type) + '</td>';
        html += '<td class="awm-bullet-count">' + (order.bullet_count || 0) + ' 发</td>';
        html += '<td class="awm-total-price">¥' + (order.total_price ? Number(order.total_price).toFixed(2) : '0.00') + '</td>';
        html += '<td style="text-align:center;"><span class="settled-toggle" data-id="' + order.id + '" style="cursor:pointer;font-size:12px;padding:2px 8px;border-radius:4px;' + (order.settled ? 'background:rgba(74,222,128,0.15);color:#4ade80;' : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);') + '" title="点击切换结单状态">' + (order.settled ? '🟢 已结' : '🟡 未结') + '</span></td>';
        html += '<td class="awm-created-at">' + formatTime(order.created_at) + '</td>';
        if (!readOnly) {
          html += '<td class="awm-actions">';
          html += '<button class="btn-edit awm-edit-btn">编辑</button>';
          html += '<button class="btn-delete awm-delete-btn">删除</button>';
          html += '</td>';
        }
      }

      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  /* ── 加载订单数据 ── */
  function loadOrders(readOnly) {
    fetch(getApiUrl())
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0 && result.data) {
          currentOrders = result.data;
          // 更新标题统计信息
          updateTitleStats();
          if (readOnly) {
            renderOrderCards(currentOrders);
          } else {
            renderOrdersTable(currentOrders);
          }
        } else {
          // 如果数据库表不存在或没有数据，显示友好的提示
          var msg = result.msg || '未知错误';
          if (msg.indexOf('Could not find the table') !== -1 || 
              msg.indexOf('relation "awm_orders" does not exist') !== -1) {
            Mode.showToast('️ 数据库未初始化，请在Supabase中执行SQL创建表', 'warn');
          } else {
            Mode.showToast('加载订单失败: ' + msg, 'warn');
          }
        }
      })
      .catch(function(err) {
        console.error('加载订单失败:', err);
        Mode.showNetworkError('❌ 网络错误，请检查网络连接');
      });
  }

  /* ── 登录 ── */
  function doLogin() {
    var passInput = document.getElementById('ordersLoginPass');
    var statusEl = document.getElementById('ordersLoginStatus');
    var pass = passInput ? passInput.value.trim() : '';

    if (!pass) {
      statusEl.textContent = '❌ 请输入密码';
      return;
    }

    // 验证密码（使用负数金额测试，密码正确会返回"总价无效"）
    fetch(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bullet_count: -1,
        total_price: -1,
        admin_pass: pass,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.msg === '总价无效' || result.msg === '子弹数量无效') {
          // 密码正确
          isAdminLoggedIn = true;
          adminPassword = pass;
          if (passInput) passInput.value = '';
          render();
        } else if (result.msg === '管理员密码错误') {
          statusEl.textContent = '❌ 密码错误';
        } else {
          statusEl.textContent = '❌ 验证失败：' + (result.msg || '未知错误');
        }
      })
      .catch(function(err) {
        statusEl.textContent = '❌ 网络错误';
      });
  }

  /* ── 退出登录 ── */
  function doLogout() {
    isAdminLoggedIn = false;
    adminPassword = '';
    editingId = null;
    currentOrders = [];
    render();
  }

  /* ── 添加订单 ── */
  function doAddOrder() {
    var dashangBtn = document.getElementById('ordersTypeDashang');
    var type = (dashangBtn && dashangBtn.style.fontWeight === '600') ? '打手上号' : '自己跟车';
    var bullets = parseInt(document.getElementById('ordersAddBullets').value);
    var price = parseFloat(document.getElementById('ordersAddPrice').value);
    var settled = document.getElementById('ordersAddSettled') && document.getElementById('ordersAddSettled').checked;
    var useNow = document.getElementById('ordersAddUseNow').checked;
    var customTime = document.getElementById('ordersAddTime').value;

    if (!bullets || bullets <= 0) {
      alert('请输入有效的子弹数量');
      return;
    }
    if (!price || price <= 0) {
      alert('请输入有效的总价');
      return;
    }

    var created_at = useNow ? null : (customTime ? new Date(customTime).toISOString() : null);
    var orderNumber = document.getElementById('ordersAddOrderNum').value;

    fetch(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_number: orderNumber,
        bullet_count: bullets,
        total_price: price,
        customer_type: type,
        settled: settled,
        admin_pass: adminPassword,
        created_at: created_at,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0) {
          // 清空表单
          document.getElementById('ordersAddBullets').value = '';
          document.getElementById('ordersAddPrice').value = '';
          // 重新生成订单号
          document.getElementById('ordersAddOrderNum').value = generateOrderNumber();
          loadOrders();
        } else {
          // 更友好的错误提示
          var msg = result.msg || '未知错误';
          if (msg.indexOf('Could not find the table') !== -1 || 
              msg.indexOf('relation "awm_orders" does not exist') !== -1) {
            Mode.showToast('⚠️ 添加失败：数据库表不存在，请先在Supabase中创建awm_orders表', 'warn');
          } else {
            Mode.showToast('添加失败：' + msg, 'warn');
          }
        }
      })
      .catch(function(err) {
        Mode.showNetworkError('❌ 网络错误，请检查网络连接');
      });
  }

  /* ── 表格操作处理 ── */
  function handleTableAction(e) {
    // 复制按钮
    var copyBtn = e.target.closest('.copy-btn-order');
    if (copyBtn) {
      copyOrderNumber(copyBtn.dataset.order, copyBtn);
      return;
    }

    var btn = e.target.closest('button');
    if (!btn) {
      // 检查是否是结单状态切换
      var toggle = e.target.closest('.settled-toggle');
      if (toggle) {
        toggleSettled(toggle.dataset.id);
        return;
      }
      return;
    }

    var row = btn.closest('tr');
    if (!row) return;

    var id = row.dataset.id;

    if (btn.classList.contains('btn-edit')) {
      editingId = parseInt(id);
      renderOrdersTable(currentOrders);
    } else if (btn.classList.contains('btn-delete')) {
      deleteOrder(id);
    } else if (btn.classList.contains('btn-save')) {
      saveOrder(row, id);
    } else if (btn.classList.contains('btn-cancel')) {
      editingId = null;
      renderOrdersTable(currentOrders);
    }
  }

  /* ── 删除订单 ── */
  function deleteOrder(id) {
    if (!confirm('确定要删除这条订单记录吗？此操作不可恢复！')) return;

    fetch(getApiUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: parseInt(id),
        admin_pass: adminPassword,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0) {
          loadOrders();
        } else {
          alert('删除失败：' + (result.msg || '未知错误'));
        }
      })
      .catch(function(err) {
        Mode.showToast('❌ 网络错误', 'error');
      });
  }

  /* ── 保存编辑 ── */
  function saveOrder(row, id) {
    var type = row.querySelector('.edit-type').value;
    var bullets = parseInt(row.querySelector('.edit-bullets').value);
    var price = parseFloat(row.querySelector('.edit-price').value);
    var settled = parseInt(row.querySelector('.edit-settled').value) === 1;

    if (!bullets || bullets <= 0) {
      alert('请输入有效的子弹数量');
      return;
    }
    if (!price || price <= 0) {
      alert('请输入有效的总价');
      return;
    }

    fetch(getApiUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: parseInt(id),
        customer_type: type,
        bullet_count: bullets,
        total_price: price,
        settled: settled,
        admin_pass: adminPassword,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0) {
          editingId = null;
          loadOrders();
        } else {
          alert('保存失败：' + (result.msg || '未知错误'));
        }
      })
      .catch(function(err) {
        Mode.showToast('❌ 网络错误', 'error');
      });
  }

  /* ── 切换结单状态 ── */
  function toggleSettled(id) {
    var order = currentOrders.find(function(o) { return o.id == id; });
    if (!order) return;
    var newSettled = !order.settled;
    fetch(getApiUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: parseInt(id),
        settled: newSettled,
        admin_pass: adminPassword,
      }),
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0) {
          loadOrders();
        } else {
          alert('操作失败：' + (result.msg || '未知错误'));
        }
      })
      .catch(function(err) {
        Mode.showToast('❌ 网络错误', 'error');
      });
  }

  /* ── 复制订单号 ── */
  function copyOrderNumber(orderNum, el) {
    if (!orderNum) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(orderNum).then(function() {
          showCopyFeedback(el);
        }).catch(function() {
          fallbackCopy(orderNum, el);
        });
      } else {
        fallbackCopy(orderNum, el);
      }
    } catch (e) {
      fallbackCopy(orderNum, el);
    }
  }

  function fallbackCopy(text, el) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopyFeedback(el);
    } catch (e) {
      alert('复制失败，请手动复制：' + text);
    }
    document.body.removeChild(textarea);
  }

  function showCopyFeedback(el) {
    var orig = el.textContent;
    el.textContent = '✅ 已复制';
    el.style.color = '#4ade80';
    setTimeout(function() {
      el.textContent = orig;
      el.style.color = '';
    }, 1200);
  }

  /* ── 搜索过滤 ── */
  function handleSearch() {
    var keyword = document.getElementById('ordersSearch').value.toLowerCase().trim();
    if (!keyword) {
      renderOrdersTable(currentOrders);
      return;
    }

    var filtered = currentOrders.filter(function(order) {
      var searchText = (
        order.customer_type + ' ' +
        order.bullet_count + ' ' +
        order.total_price
      ).toLowerCase();
      return searchText.includes(keyword);
    });

    renderOrdersTable(filtered);
  }

  /* ── 公开接口 ── */
  return {
    init: function() {
      // ★ 防止重复初始化（避免 renderDonationsSlot 多次调用导致回收AW反复刷新）
      if (window._bqb_awm_inited) return;
      // 如果容器还不存在（比如还没打开关于页面），也不标记初始化
      if (!getContainer()) return;
      window._bqb_awm_inited = true;
      render();
    },
    reRender: function() {
      render();
    },
  };
})();

/* 页面就绪后自动启动
 * ★ 注意：不在此处调用 AwmOrders.init()，因为回收AW的容器 #awmOrdersSlot
 *   由 guanyu.js 的 render() 创建并管理生命周期。init() 由 guanyu.js 的
 *   renderDonationsSlot() 统一调用，避免与 Mode.ready 产生时序竞态。
 */