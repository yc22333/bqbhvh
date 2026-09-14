/* ============================================================
   biaoti.js — AW子弹报价（英雄区）交互逻辑
   功能: AW子弹报价标题区的动态效果与交互
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-10] [SELF-CONTAINED]
   ============================================================ */

const AwmZiDanBiaoti = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    debugTag: 'AwmZiDanBiaoti',
  };

  /* ── 内部状态 ── */
  let initialized = false;

  /* ── 初始化 ── */
  function init() {
    if (initialized) return;
    initialized = true;

    /* ── 选项卡切换（切换后自动重算金额） ── */
    var tabs = document.querySelectorAll('.awm-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        var target = this.getAttribute('data-tab');
        var panels = document.querySelectorAll('.awm-panel');
        panels.forEach(function(p) { p.classList.remove('active'); });
        var targetPanel = document.getElementById('awmPanel' + target.charAt(0).toUpperCase() + target.slice(1));
        if (targetPanel) targetPanel.classList.add('active');

        // 同步切换底部统计区域和须知区域
        var sections = document.querySelectorAll('.awm-stats-section, .awm-bottom-section');
        sections.forEach(function(s) { s.classList.remove('active'); });
        var targetStats = document.getElementById('awmStats' + target.charAt(0).toUpperCase() + target.slice(1));
        if (targetStats) targetStats.classList.add('active');
        var targetBottom = document.getElementById('awmBottom' + target.charAt(0).toUpperCase() + target.slice(1));
        if (targetBottom) targetBottom.classList.add('active');

        // 切换后自动刷新金额显示
        if (typeof refreshAllPanels === 'function') refreshAllPanels();
      });
    });

    /* ── 选项按钮切换 ── */
    var options = document.querySelectorAll('.awm-option');
    options.forEach(function(opt) {
      opt.addEventListener('click', function() {
        var panel = this.closest('.awm-panel');
        if (!panel) return;
        var opts = panel.querySelectorAll('.awm-option');
        opts.forEach(function(o) { o.classList.remove('active'); });
        this.classList.add('active');

        // 切换价格注释
        var note = this.getAttribute('data-price-note');
        var noteEl = panel.querySelector('.awm-price-note');
        if (note && noteEl) {
          noteEl.innerHTML = note;
        }
      });
    });

    /* ── 初始化：同步当前选中选项的价格注释 ── */
    document.querySelectorAll('.awm-option.active').forEach(function(opt) {
      var panel = opt.closest('.awm-panel');
      if (!panel) return;
      var note = opt.getAttribute('data-price-note');
      var noteEl = panel.querySelector('.awm-price-note');
      if (note && noteEl) {
        noteEl.innerHTML = note;
      }
    });

    /* ── 卖AW模块 ── */
    initAwmDonations();

    /* ── 回收AW模块（从orders.js复用） ── */
    if (typeof AwmOrders !== 'undefined' && AwmOrders.init) {
      AwmOrders.init();
    } else {
      Mode.Debug.warn(CONFIG.debugTag, 'AwmOrders not loaded, fallback to local');
      initAwmOrders();
    }

    /* ── 金额计算 ── */
    initAmountCalc();

    /* ── 微信号复制 ── */
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.awm-avatar-copy');
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
        // 降级方案
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

    Mode.Debug.log(CONFIG.debugTag, 'AW子弹报价模块已就绪 ✅');
  }

  /* ── 检测是否为本地环境（file:// 或 localhost） ── */
  function isLocalEnvironment() {
    // file:// 协议（直接双击打开HTML）
    if (window.location.protocol === 'file:') return true;
    // localhost / 127.0.0.1（VS Code Live Server 等本地服务器）
    var host = window.location.hostname;
    if (host === '' || host === 'localhost' || host === '127.0.0.1') return true;
    return false;
  }

  /* ── 卖AW：加载并渲染到AWM购买面板 ── */
  function initAwmDonations() {
    var container = document.getElementById('awmDonationsContainer');
    if (!container) {
      Mode.Debug.warn(CONFIG.debugTag, 'awmDonationsContainer not found');
      return;
    }

    // ★ 本地环境（file:// 或 localhost）：不发起网络请求，但保留管理员登录UI
    if (isLocalEnvironment()) {
      container.innerHTML = '<div style="margin-top:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(74,222,128,0.2);border-radius:12px;padding:12px;box-sizing:border-box;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">' +
        '<span style="color:#4ade80;font-size:15px;font-weight:600;">💵 卖AW</span>' +
        '<button id="donationLoginShowBtn" class="admin-toggle-btn" style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);flex-shrink:0;font-size:12px;padding:4px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;cursor:pointer;">🔧 管理员登录</button>' +
        '</div>' +
        '<div id="donationLoginPanel" class="admin-panel" style="display:none;margin-bottom:10px;padding:10px;background:rgba(0,0,0,0.15);border-radius:8px;">' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:6px;">🔐 管理员登录</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<input id="donationLoginPass" type="password" placeholder="请输入管理员密码" class="admin-input" style="flex:1;min-width:120px;padding:6px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(0,0,0,0.3);color:#fff;font-size:13px;">' +
        '<button id="donationLoginBtn" class="admin-submit-btn" style="padding:6px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:600;">登录</button>' +
        '</div>' +
        '<div id="donationLoginStatus" class="admin-status" style="color:#ff6b6b;font-size:12px;margin-top:4px;"></div>' +
        '</div>' +
        '<div style="margin-bottom:10px;">' +
        '<input id="donationSearch" type="text" placeholder="🔍 搜索订单号..." class="admin-input" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(0,0,0,0.3);color:#fff;font-size:13px;">' +
        '</div>' +
        '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.4);">📁 本地预览模式 — 部署上线后自动加载数据</div>' +
        '</div>';

      // 绑定本地环境的事件
      setTimeout(function() {
        var loginShowBtn = document.getElementById('donationLoginShowBtn');
        if (loginShowBtn) {
          loginShowBtn.addEventListener('click', function() {
            var panel = document.getElementById('donationLoginPanel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          });
        }
        var loginBtn = document.getElementById('donationLoginBtn');
        if (loginBtn) loginBtn.addEventListener('click', doDonationLogin);
        var loginPass = document.getElementById('donationLoginPass');
        if (loginPass) {
          loginPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doDonationLogin();
          });
        }
        var searchInput = document.getElementById('donationSearch');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            var keyword = this.value.trim().toLowerCase();
            var cards = document.querySelectorAll('#donationCardsContainer .donation-card');
            cards.forEach(function(card) {
              var orderText = (card.getAttribute('data-order') || '').toLowerCase();
              card.style.display = orderText.indexOf(keyword) !== -1 ? '' : 'none';
            });
          });
        }
      }, 0);
      return;
    }

    // 显示加载中
    container.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.5);">⏳ 加载卖AW记录...</div>';

    // 内部状态
    var allDonations = [];
    var isAdminLoggedIn = false;
    var editingId = null;
    var adminPassword = '';

    // 获取API地址
    function getApiUrl() {
      return '/.netlify/functions/donations';
    }

    // 格式化时间
    function formatTime(isoString) {
      if (!isoString) return '';
      var date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, '0');
      var d = String(date.getDate()).padStart(2, '0');
      var h = String(date.getHours()).padStart(2, '0');
      var min = String(date.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + d + ' ' + h + ':' + min;
    }

    // 生成订单号（D+月日时分）
    function generateOrderNumber() {
      var now = new Date();
      var y = String(now.getFullYear()).slice(2);
      var m = String(now.getMonth() + 1).padStart(2, '0');
      var d = String(now.getDate()).padStart(2, '0');
      var h = String(now.getHours()).padStart(2, '0');
      var min = String(now.getMinutes()).padStart(2, '0');
      return 'D' + y + m + d + h + min + String(now.getSeconds()).padStart(2, '0');
    }

    // 防XSS
    function escapeHtml(str) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str || ''));
      return div.innerHTML;
    }

    // 管理员登录（使用 POST 验证，与 orders.js 一致）
    function doDonationLogin() {
      var passEl = document.getElementById('donationLoginPass');
      var statusEl = document.getElementById('donationLoginStatus');
      if (!passEl || !statusEl) return;
      var pass = passEl.value.trim();
      if (!pass) { statusEl.textContent = '请输入密码'; return; }

      fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bullet_count: -1,
          total_price: -1,
          admin_pass: pass,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res.msg === '总价无效' || res.msg === '子弹数量无效' || res.msg === '金额无效') {
            isAdminLoggedIn = true;
            adminPassword = pass;
            statusEl.textContent = '✅ 登录成功';
            statusEl.style.color = '#4ade80';
            renderCards(allDonations);
          } else if (res.msg === '管理员密码错误') {
            statusEl.textContent = '❌ 密码错误';
          } else {
            statusEl.textContent = '❌ 验证失败：' + (res.msg || '未知错误');
          }
        })
        .catch(function() {
          statusEl.textContent = '❌ 网络错误';
          statusEl.style.color = '#ff6b6b';
        });
    }

    // 管理员退出
    function doDonationLogout() {
      isAdminLoggedIn = false;
      adminPassword = '';
      editingId = null;
      renderCards(allDonations);
    }

    // ── 添加新捐赠 ──
    function doAddDonation() {
      var orderNum = document.getElementById('donationAddOrderNum');
      var typeDashang = document.getElementById('donationTypeDashang');
      var bullets = document.getElementById('donationAddBullets');
      var price = document.getElementById('donationAddPrice');
      var unsettled = document.getElementById('donationAddUnsettled');
      var settledCB = document.getElementById('donationAddSettled');
      var useNow = document.getElementById('donationAddUseNow');
      var customTime = document.getElementById('donationAddTime');
      if (!orderNum || !bullets || !price) return;

      var type = (typeDashang && typeDashang.style.fontWeight === '600') ? '打手上号' : '自己跟车';
      var bulletVal = parseInt(bullets.value);
      var priceVal = parseFloat(price.value);
      var settled = settledCB && settledCB.checked;
      var useNowVal = useNow && useNow.checked;
      var created_at = useNowVal ? null : (customTime && customTime.value ? new Date(customTime.value).toISOString() : null);

      if (!bulletVal || bulletVal <= 0) { alert('请输入有效的子弹数量'); return; }
      if (!priceVal || priceVal <= 0) { alert('请输入有效的总价'); return; }

      fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: orderNum.value,
          message: bulletVal,
          amount: priceVal,
          nickname: type,
          settled: settled,
          admin_pass: adminPassword,
          created_at: created_at,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (result.ret === 0) {
            bullets.value = '';
            price.value = '';
            orderNum.value = generateOrderNumber();
            loadDonations();
          } else {
            alert('添加失败：' + (result.msg || '未知错误'));
          }
        })
        .catch(function() { alert('网络错误'); });
    }

    // ── 保存编辑 ──
    function saveDonation(row, id) {
      var type = row.querySelector('.edit-type').value;
      var bullets = parseInt(row.querySelector('.edit-bullets').value);
      var price = parseFloat(row.querySelector('.edit-price').value);
      var settled = parseInt(row.querySelector('.edit-settled').value) === 1;

      if (!bullets || bullets <= 0) { alert('请输入有效的子弹数量'); return; }
      if (!price || price <= 0) { alert('请输入有效的总价'); return; }

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
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (result.ret === 0 || result.ret === true) {
            editingId = null;
            loadDonations();
          } else {
            // 兼容：API 可能要求不同的字段名
            fetch(getApiUrl(), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: parseInt(id),
                nickname: type,
                message: bullets,
                amount: price,
                settled: settled,
                admin_pass: adminPassword,
              }),
            })
              .then(function(r2) { return r2.json(); })
              .then(function(res2) {
                if (res2.ret === 0 || res2.ret === true) {
                  editingId = null;
                  loadDonations();
                } else {
                  alert('保存失败：' + (result.msg || res2.msg || '未知错误'));
                }
              })
              .catch(function() { alert('网络错误'); });
          }
        })
        .catch(function() { alert('网络错误'); });
    }

    // ── 删除捐赠 ──
    function deleteDonation(id) {
      if (!confirm('确定要删除此条记录吗？')) return;

      fetch(getApiUrl(), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(id), admin_pass: adminPassword }),
      })
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (result.ret === 0) {
            loadDonations();
          } else {
            alert('删除失败：' + (result.msg || '未知错误'));
          }
        })
        .catch(function() { alert('网络错误'); });
    }

    // ── 加载数据 ──
    function loadDonations() {
      fetch(getApiUrl())
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (result.ret === 0 && result.data) {
            allDonations = result.data;
            renderCards(allDonations);
          } else {
            container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">暂无卖AW记录 📭</div>';
          }
        })
        .catch(function(err) {
          Mode.Debug.warn(CONFIG.debugTag, '加载卖AW记录失败: ' + err.message);
          container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">⚠️ 网络错误，加载失败</div>';
        });
    }

    // ── 渲染添加表单 ──
    function renderAddForm() {
      var now = new Date();
      var defaultTime = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + 'T' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

      return '<div class="admin-add-form admin-panel" style="margin-top:0;margin-bottom:12px;">' +
        '<div class="admin-panel-title">➕ 添加新订单</div>' +
        '<div class="admin-row" style="margin-bottom:10px;">' +
        '<input type="text" id="donationAddOrderNum" class="admin-input" readonly value="' + generateOrderNumber() + '" style="color:rgba(255,255,255,0.5);width:100%;box-sizing:border-box;">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
        '<div style="display:flex;flex-direction:column;">' +
        '<label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:6px;">客户类型</label>' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' +
        '<button id="donationTypeDashang" class="admin-input" style="padding:8px;cursor:pointer;text-align:center;background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);font-weight:600;">✅ 打手上号</button>' +
        '<button id="donationTypeZiji" class="admin-input" style="padding:8px;cursor:pointer;text-align:center;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);font-weight:400;">自己跟车<br><span style="font-size:11px;font-weight:400;">(1.1/发)</span></button>' +
        '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<div style="display:flex;flex-direction:column;">' +
        '<label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:4px;">子弹数量（发）</label>' +
        '<input type="number" id="donationAddBullets" placeholder="输入数量" min="1" class="admin-input">' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;">' +
        '<label style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:4px;">总价（元）</label>' +
        '<input type="number" id="donationAddPrice" placeholder="自动计算" step="0.01" min="0" class="admin-input" readonly style="color:#4ade80;font-weight:600;">' +
        '</div></div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<label style="color:rgba(255,255,255,0.5);font-size:12px;white-space:nowrap;">创建时间：</label>' +
        '<input type="datetime-local" id="donationAddTime" value="' + defaultTime + '" class="admin-input" style="flex:1;padding:6px 10px;font-size:12px;">' +
        '<label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;white-space:nowrap;">' +
        '<input type="checkbox" id="donationAddUseNow" checked style="cursor:pointer;"> 使用当前时间' +
        '</label></div>' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
        '<label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;">' +
        '<input type="checkbox" id="donationAddUnsettled" checked style="cursor:pointer;width:16px;height:16px;"> 未结单</label>' +
        '<label style="display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7);font-size:13px;cursor:pointer;">' +
        '<input type="checkbox" id="donationAddSettled" style="cursor:pointer;width:16px;height:16px;"> 已结单</label>' +
        '<div style="flex:1;"></div>' +
        '<button id="donationAddBtn" class="admin-submit-btn">📝 添加订单</button>' +
        '</div></div>';
    }

    // ── 渲染表格 ──
    function renderTable(donations) {
      if (!donations || !Array.isArray(donations) || donations.length === 0) {
        return '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.5);">暂无订单记录</div>';
      }

      var html = '<div class="admin-table-wrapper hide-scrollbar" style="max-height:55vh;overflow-y:auto;"><table class="admin-table">';
      html += '<thead><tr>';
      html += '<th>订单号</th><th>客户类型</th><th>子弹数量</th><th>总价</th><th>状态</th><th>时间</th>';
      html += '<th style="text-align:center;">操作</th>';
      html += '</tr></thead><tbody>';

      for (var i = 0; i < donations.length; i++) {
        var d = donations[i];
        var isEditing = String(editingId) === String(d.id);
        html += '<tr data-id="' + d.id + '">';

        if (isEditing) {
          html += '<td style="color:rgba(255,255,255,0.5);font-size:11px;">' + escapeHtml(d.order_number || '') + '</td>';
          html += '<td><select class="edit-type admin-input" style="padding:4px 8px;font-size:12px;width:100%;">';
          html += '<option value="打手上号"' + (d.nickname === '打手上号' || d.customer_type === '打手上号' ? ' selected' : '') + '>打手上号</option>';
          html += '<option value="自己跟车"' + (d.nickname === '自己跟车' || d.customer_type === '自己跟车' ? ' selected' : '') + '>自己跟车</option>';
          html += '</select></td>';
          html += '<td><input type="number" class="edit-bullets admin-input" value="' + (d.message || d.bullet_count || 0) + '" min="1" style="width:100%;padding:4px 8px;font-size:12px;box-sizing:border-box;"></td>';
          html += '<td><input type="number" class="edit-price admin-input" value="' + (d.amount || d.total_price || 0) + '" step="0.01" min="0" style="width:100%;padding:4px 8px;font-size:12px;box-sizing:border-box;"></td>';
          html += '<td><select class="edit-settled admin-input" style="padding:4px 8px;font-size:12px;">';
          html += '<option value="0"' + (d.settled ? '' : ' selected') + '>🟡 未结</option>';
          html += '<option value="1"' + (d.settled ? ' selected' : '') + '>🟢 已结</option>';
          html += '</select></td>';
          html += '<td style="color:rgba(255,255,255,0.5);font-size:12px;">' + formatTime(d.created_at) + '</td>';
          html += '<td class="awm-actions">';
          html += '<button class="btn-save awm-save-btn" style="padding:4px 12px;font-size:12px;margin-right:4px;">保存</button>';
          html += '<button class="btn-cancel awm-cancel-btn" style="padding:4px 12px;font-size:12px;">取消</button>';
          html += '</td>';
        } else {
          var orderNum = escapeHtml(d.order_number || d.order_id || '');
          var customerType = escapeHtml(d.nickname || d.customer_type || '打手上号');
          var bulletCount = parseInt(d.message || d.bullet_count || 0);
          var totalPrice = Number(d.amount || d.total_price || 0).toFixed(2);
          var settled = d.settled === true || d.settled === 'true';
          var timeStr = formatTime(d.created_at);

          html += '<td style="color:rgba(255,255,255,0.5);font-size:11px;">' + (orderNum || '-') + ' <button class="copy-btn-order" data-order="' + orderNum + '" style="background:rgba(245,184,46,0.15);color:#f5b82e;border:none;padding:1px 6px;border-radius:3px;cursor:pointer;font-size:10px;vertical-align:middle;">📋</button></td>';
          html += '<td style="color:#d4c8a8;">' + customerType + '</td>';
          html += '<td class="awm-bullet-count">' + bulletCount + ' 发</td>';
          html += '<td class="awm-total-price">¥' + totalPrice + '</td>';
          html += '<td style="text-align:center;"><span class="settled-toggle" data-id="' + d.id + '" style="cursor:pointer;font-size:12px;padding:2px 8px;border-radius:4px;' + (settled ? 'background:rgba(74,222,128,0.15);color:#4ade80;' : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);') + '" title="点击切换结单状态">' + (settled ? '🟢 已结' : '🟡 未结') + '</span></td>';
          html += '<td class="awm-created-at">' + timeStr + '</td>';
          html += '<td class="awm-actions">';
          html += '<button class="btn-edit awm-edit-btn" data-id="' + d.id + '" style="padding:4px 8px;font-size:12px;margin-right:4px;">编辑</button>';
          html += '<button class="btn-delete awm-delete-btn" data-id="' + d.id + '" style="padding:4px 8px;font-size:12px;">删除</button>';
          html += '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      return html;
    }

    // ── 渲染管理员面板 ──
    function renderAdminPanel(donations) {
      var totalAmount = 0;
      for (var i = 0; i < donations.length; i++) {
        totalAmount += Number(donations[i].amount || donations[i].total_price || 0);
      }

      var html = '<div style="margin-top:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(74,222,128,0.2);border-radius:12px;padding:12px;box-sizing:border-box;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">';
      html += '<span style="color:#4ade80;font-size:15px;font-weight:600;">💵 卖AW <span style="font-size:12px;color:rgba(255,255,255,0.4);">（共 ' + donations.length + ' 条）💰 累计：¥' + totalAmount.toFixed(2) + '</span></span>';
      html += '<button id="donationLogoutBtn" class="admin-toggle-btn" style="background:rgba(255,100,100,0.2);color:#ff6b6b;flex-shrink:0;font-size:12px;padding:4px 10px;border:1px solid rgba(255,100,100,0.3);border-radius:6px;cursor:pointer;">🔐 退出管理</button>';
      html += '</div>';

      // 搜索框
      html += '<div style="margin-bottom:10px;">';
      html += '<input id="donationAdminSearch" type="text" placeholder="🔍 搜索订单号..." class="admin-input" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(0,0,0,0.3);color:#fff;font-size:13px;">';
      html += '</div>';

      // 添加表单
      html += renderAddForm();

      // 表格
      html += '<div id="donationTableContainer">' + renderTable(donations) + '</div>';
      html += '</div>';

      container.innerHTML = html;

      // 绑定事件
      setTimeout(function() {
        // 退出
        var logoutBtn = document.getElementById('donationLogoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', doDonationLogout);

        // 添加订单
        var addBtn = document.getElementById('donationAddBtn');
        if (addBtn) addBtn.addEventListener('click', doAddDonation);

        // 客户类型按钮切换
        var dashangBtn = document.getElementById('donationTypeDashang');
        var zijiBtn = document.getElementById('donationTypeZiji');
        if (dashangBtn && zijiBtn) {
          function setType(type) {
            if (type === 'dashang') {
              dashangBtn.innerHTML = '✅ 打手上号';
              dashangBtn.style.background = 'rgba(74,222,128,0.15)';
              dashangBtn.style.color = '#4ade80';
              dashangBtn.style.border = '1px solid rgba(74,222,128,0.3)';
              dashangBtn.style.fontWeight = '600';
              zijiBtn.innerHTML = '自己跟车<br><span style="font-size:11px;font-weight:400;">(1.1/发)</span>';
              zijiBtn.style.background = 'rgba(255,255,255,0.05)';
              zijiBtn.style.color = 'rgba(255,255,255,0.5)';
              zijiBtn.style.border = '1px solid rgba(255,255,255,0.1)';
              zijiBtn.style.fontWeight = '400';
            } else {
              zijiBtn.innerHTML = '✅ 自己跟车<br><span style="font-size:11px;font-weight:400;">(1.1/发)</span>';
              zijiBtn.style.background = 'rgba(74,222,128,0.15)';
              zijiBtn.style.color = '#4ade80';
              zijiBtn.style.border = '1px solid rgba(74,222,128,0.3)';
              zijiBtn.style.fontWeight = '600';
              dashangBtn.innerHTML = '打手上号';
              dashangBtn.style.background = 'rgba(255,255,255,0.05)';
              dashangBtn.style.color = 'rgba(255,255,255,0.5)';
              dashangBtn.style.border = '1px solid rgba(255,255,255,0.1)';
              dashangBtn.style.fontWeight = '400';
            }
            autoCalcPrice();
          }
          dashangBtn.addEventListener('click', function() { setType('dashang'); });
          zijiBtn.addEventListener('click', function() { setType('ziji'); });
        }

        // 未结单/已结单互斥
        var addUnsettled = document.getElementById('donationAddUnsettled');
        var addSettledCB = document.getElementById('donationAddSettled');
        if (addUnsettled && addSettledCB) {
          addUnsettled.addEventListener('change', function() {
            if (this.checked) addSettledCB.checked = false;
          });
          addSettledCB.addEventListener('change', function() {
            if (this.checked) addUnsettled.checked = false;
          });
        }

        // 搜索
        var searchInput = document.getElementById('donationAdminSearch');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            var keyword = this.value.trim().toLowerCase();
            var rows = document.querySelectorAll('#donationTableContainer table tbody tr');
            rows.forEach(function(row) {
              var orderText = (row.cells[0] ? row.cells[0].textContent : '').toLowerCase();
              row.style.display = orderText.indexOf(keyword) !== -1 ? '' : 'none';
            });
          });
        }

        // 自动计算价格
        var addBullets = document.getElementById('donationAddBullets');
        if (addBullets) {
          addBullets.addEventListener('input', autoCalcPrice);
        }

        // 表格操作（事件委托）
        var tableContainer = document.getElementById('donationTableContainer');
        if (tableContainer) {
          // 编辑模式自动计算价格
          tableContainer.addEventListener('input', function(e) {
            if (e.target.classList.contains('edit-bullets') || e.target.classList.contains('edit-price')) {
              var row = e.target.closest('tr');
              if (!row) return;
              var bulletsInput = row.querySelector('.edit-bullets');
              var priceInput = row.querySelector('.edit-price');
              var typeSelect = row.querySelector('.edit-type');
              if (!bulletsInput || !priceInput) return;
              if (e.target === bulletsInput || e.target === typeSelect || e.target === priceInput) {
                var qty = parseInt(bulletsInput.value) || 0;
                var isShanghao = typeSelect && typeSelect.value === '打手上号';
                var price = isShanghao ? qty * 1.15 : qty * 1.1;
                priceInput.value = price.toFixed(2);
              }
            }
          });
          tableContainer.addEventListener('click', function(e) {
            var target = e.target;
            var row = target.closest('tr');
            if (!row) return;
            var id = row.getAttribute('data-id');

            // 编辑
            if (target.classList.contains('btn-edit') || target.classList.contains('awm-edit-btn')) {
              editingId = id;
              renderAdminPanel(allDonations);
              return;
            }
            // 删除
            if (target.classList.contains('btn-delete') || target.classList.contains('awm-delete-btn')) {
              deleteDonation(id);
              return;
            }
            // 保存
            if (target.classList.contains('btn-save') || target.classList.contains('awm-save-btn')) {
              saveDonation(row, id);
              return;
            }
            // 取消
            if (target.classList.contains('btn-cancel') || target.classList.contains('awm-cancel-btn')) {
              editingId = null;
              renderAdminPanel(allDonations);
              return;
            }
            // 复制订单号
            if (target.classList.contains('copy-btn-order')) {
              var order = target.getAttribute('data-order');
              if (order) {
                navigator.clipboard.writeText(order).then(function() {
                  target.textContent = '✅';
                  setTimeout(function() { target.textContent = '📋'; }, 1500);
                }).catch(function() {});
              }
              return;
            }
            // 切换结单状态
            if (target.classList.contains('settled-toggle')) {
              var sid = target.getAttribute('data-id');
              if (sid) {
                fetch(getApiUrl(), {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: parseInt(sid), settled: true, admin_pass: adminPassword }),
                })
                  .then(function(r) { return r.json(); })
                  .then(function(res) {
                    if (res.ret === 0) loadDonations();
                  })
                  .catch(function() {});
              }
              return;
            }
          });
        }
      }, 0);
    }

    // ── 自动计算价格 ──
    function autoCalcPrice() {
      var bulletsEl = document.getElementById('donationAddBullets');
      var priceEl = document.getElementById('donationAddPrice');
      var dashangBtn = document.getElementById('donationTypeDashang');
      if (!bulletsEl || !priceEl) return;
      var qty = parseInt(bulletsEl.value) || 0;
      var isShanghao = dashangBtn && dashangBtn.style.fontWeight === '600';
      var price = isShanghao ? qty * 1.15 : qty * 1.10;
      priceEl.value = price.toFixed(2);
    }

    // 渲染（管理员/公开）
    function renderCards(donations) {
      allDonations = donations || [];
      if (isAdminLoggedIn) {
        renderAdminPanel(allDonations);
        return;
      }

      if (!allDonations || !Array.isArray(allDonations) || allDonations.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">暂无卖AW记录 📭</div>';
        return;
      }

      // 计算累计
      var totalAmount = 0;
      for (var i = 0; i < allDonations.length; i++) {
        totalAmount += Number(allDonations[i].amount || allDonations[i].total_price || 0);
      }

      var html = '<div style="margin-top:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(74,222,128,0.2);border-radius:12px;padding:12px;box-sizing:border-box;">';
      // 标题栏 + 管理员登录按钮
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">';
      html += '<span style="color:#4ade80;font-size:15px;font-weight:600;">💵 卖AW <span id="donationTitleStats" style="font-size:12px;color:rgba(255,255,255,0.4);">（共 ' + allDonations.length + ' 条）💰 累计：¥' + totalAmount.toFixed(2) + '</span></span>';
      html += '<button id="donationLoginShowBtn" class="admin-toggle-btn" style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);flex-shrink:0;font-size:12px;padding:4px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;cursor:pointer;">🔧 管理员登录</button>';
      html += '</div>';

      // 管理员登录面板
      html += '<div id="donationLoginPanel" class="admin-panel" style="display:none;margin-bottom:10px;padding:10px;background:rgba(0,0,0,0.15);border-radius:8px;">';
      html += '<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:6px;">🔐 管理员登录</div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
      html += '<input id="donationLoginPass" type="password" placeholder="请输入管理员密码" class="admin-input" style="flex:1;min-width:120px;padding:6px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(0,0,0,0.3);color:#fff;font-size:13px;">';
      html += '<button id="donationLoginBtn" class="admin-submit-btn" style="padding:6px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:600;">登录</button>';
      html += '</div>';
      html += '<div id="donationLoginStatus" class="admin-status" style="color:#ff6b6b;font-size:12px;margin-top:4px;"></div>';
      html += '</div>';

      // 搜索框
      html += '<div style="margin-bottom:10px;">';
      html += '<input id="donationSearch" type="text" placeholder="🔍 搜索订单号..." class="admin-input" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:6px;background:rgba(0,0,0,0.3);color:#fff;font-size:13px;">';
      html += '</div>';

      // 卡片区域
      html += '<div id="donationCardsContainer" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;">';

      for (var i = 0; i < allDonations.length; i++) {
        var d = allDonations[i];
        var customerType = escapeHtml(d.nickname || d.customer_type || '打手上号');
        var bulletCount = parseInt(d.message || d.bullet_count || 0);
        var totalPrice = Number(d.amount || d.total_price || 0).toFixed(2);
        var settled = d.settled === true || d.settled === 'true';
        var timeStr = formatTime(d.created_at);
        var orderNum = escapeHtml(d.order_number || d.order_id || '');

        html += '<div class="donation-card" data-order="' + orderNum + '" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;display:flex;flex-direction:column;min-height:120px;">';
        html += '<div style="font-size:12px;color:#5bc0de;font-weight:600;text-align:center;flex-shrink:0;">' + customerType + '</div>';
        if (orderNum) {
          html += '<div style="font-size:10px;color:rgba(255,255,255,0.35);text-align:center;flex-shrink:0;">📋 ' + orderNum + '</div>';
        }
        html += '<div style="font-size:15px;color:#f5b82e;font-weight:700;text-align:center;margin-top:4px;flex-shrink:0;">🔫 ' + bulletCount + ' 发</div>';
        html += '<div style="font-size:17px;color:#4ade80;font-weight:700;text-align:center;margin-top:2px;flex-shrink:0;">¥' + totalPrice + '</div>';
        html += '<div style="text-align:center;margin-top:6px;flex-shrink:0;">';
        html += '<span style="display:inline-block;font-size:10px;padding:1px 8px;border-radius:4px;' + (settled ? 'background:rgba(74,222,128,0.15);color:#4ade80;' : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);') + '">' + (settled ? '🟢 已结' : '🟡 未结') + '</span>';
        html += '</div>';
        if (timeStr) {
          html += '<div style="font-size:10px;color:rgba(255,255,255,0.35);text-align:center;margin-top:auto;padding-top:4px;border-top:1px dashed rgba(255,255,255,0.06);flex-shrink:0;">🕐' + timeStr + '</div>';
        }
        html += '</div>';
      }

      html += '</div></div>';
      container.innerHTML = html;

      // 绑定事件
      setTimeout(function() {
        var loginShowBtn = document.getElementById('donationLoginShowBtn');
        if (loginShowBtn) {
          loginShowBtn.addEventListener('click', function() {
            var panel = document.getElementById('donationLoginPanel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
          });
        }
        var loginBtn = document.getElementById('donationLoginBtn');
        if (loginBtn) loginBtn.addEventListener('click', doDonationLogin);
        var loginPass = document.getElementById('donationLoginPass');
        if (loginPass) {
          loginPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') doDonationLogin();
          });
        }
        var searchInput = document.getElementById('donationSearch');
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            var keyword = this.value.trim().toLowerCase();
            var cards = document.querySelectorAll('#donationCardsContainer .donation-card');
            cards.forEach(function(card) {
              var orderText = (card.getAttribute('data-order') || '').toLowerCase();
              card.style.display = orderText.indexOf(keyword) !== -1 ? '' : 'none';
            });
          });
        }
      }, 0);
    }

    // 加载数据
    fetch(getApiUrl())
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0 && result.data) {
          allDonations = result.data;
          renderCards(result.data);
        } else {
          container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">暂无卖AW记录 📭</div>';
        }
      })
      .catch(function(err) {
        Mode.Debug.warn(CONFIG.debugTag, '加载卖AW记录失败: ' + err.message);
        container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">⚠️ 网络错误，加载失败</div>';
      });
  }

  /* ── 回收AW：加载并渲染到AWM回收面板 ── */
  function initAwmOrders() {
    var container = document.getElementById('awmOrdersContainer');
    if (!container) {
      Mode.Debug.warn(CONFIG.debugTag, 'awmOrdersContainer not found');
      return;
    }

    // ★ 本地环境（file:// 或 localhost）直接显示预览提示，不发起网络请求
    if (isLocalEnvironment()) {
      container.innerHTML = '<div style="margin-top:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(91,192,222,0.2);border-radius:12px;padding:16px;text-align:center;box-sizing:border-box;">' +
        '<div style="color:#5bc0de;font-size:15px;font-weight:600;margin-bottom:6px;">♻️ 回收AW</div>' +
        '<div style="color:rgba(255,255,255,0.4);font-size:13px;">📁 本地预览模式</div>' +
        '<div style="color:rgba(255,255,255,0.25);font-size:11px;margin-top:4px;">部署上线后自动加载数据</div>' +
        '</div>';
      return;
    }

    // 显示加载中
    container.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.5);">⏳ 加载回收AW记录...</div>';

    // 获取API地址
    function getApiUrl() {
      return '/.netlify/functions/orders';
    }

    // 格式化时间
    function formatTime(iso) {
      if (!iso) return '-';
      var d = new Date(iso);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var h = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + day + ' ' + h + ':' + min;
    }

    // 防XSS
    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // 渲染卡片
    function renderCards(orders) {
      if (!orders || !Array.isArray(orders) || orders.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">暂无回收AW记录 📭</div>';
        return;
      }

      // 计算累计
      var totalAmount = 0;
      for (var i = 0; i < orders.length; i++) {
        totalAmount += Number(orders[i].total_price || orders[i].amount || 0);
      }

      var html = '<div style="margin-top:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(91,192,222,0.2);border-radius:12px;padding:12px;box-sizing:border-box;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">';
      html += '<span style="color:#5bc0de;font-size:15px;font-weight:600;">♻️ 回收AW <span style="font-size:12px;color:rgba(255,255,255,0.4);">（共 ' + orders.length + ' 条）💰 累计：¥' + totalAmount.toFixed(2) + '</span></span>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;">';

      for (var i = 0; i < orders.length; i++) {
        var d = orders[i];
        var customerType = escapeHtml(d.customer_type || d.type || '打手上号');
        var bulletCount = parseInt(d.bullet_count || d.bullets || 0);
        var totalPrice = Number(d.total_price || d.amount || 0).toFixed(2);
        var settled = d.settled === true || d.settled === 'true';
        var timeStr = formatTime(d.created_at || d.time);

        html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;display:flex;flex-direction:column;min-height:120px;">';
        html += '<div style="font-size:12px;color:#5bc0de;font-weight:600;text-align:center;flex-shrink:0;">' + customerType + '</div>';
        html += '<div style="font-size:15px;color:#f5b82e;font-weight:700;text-align:center;margin-top:4px;flex-shrink:0;">🔫 ' + bulletCount + ' 发</div>';
        html += '<div style="font-size:17px;color:#4ade80;font-weight:700;text-align:center;margin-top:2px;flex-shrink:0;">¥' + totalPrice + '</div>';
        html += '<div style="text-align:center;margin-top:6px;flex-shrink:0;">';
        html += '<span style="display:inline-block;font-size:10px;padding:1px 8px;border-radius:4px;' + (settled ? 'background:rgba(74,222,128,0.15);color:#4ade80;' : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);') + '">' + (settled ? '🟢 已结' : '🟡 未结') + '</span>';
        html += '</div>';
        if (timeStr) {
          html += '<div style="font-size:10px;color:rgba(255,255,255,0.35);text-align:center;margin-top:auto;padding-top:4px;border-top:1px dashed rgba(255,255,255,0.06);flex-shrink:0;">🕐' + timeStr + '</div>';
        }
        html += '</div>';
      }

      html += '</div></div>';
      container.innerHTML = html;
    }

    // 加载数据
    fetch(getApiUrl())
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ret === 0 && result.data) {
          renderCards(result.data);
        } else {
          container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">暂无回收AW记录 📭</div>';
        }
      })
      .catch(function(err) {
        Mode.Debug.warn(CONFIG.debugTag, '加载回收AW记录失败: ' + err.message);
        container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);">⚠️ 网络错误，加载失败</div>';
      });
  }

  /* ── 金额计算逻辑（配置驱动·重构版） ── */
  function initAmountCalc() {

    /* ── 定价配置表 ── */
    var PRICING = {
      // 购买模式：固定单价
      buy: {
        genche:  1.1,
        shanghao: 1.15,
      },
      // 回收模式：统一单价（打手上号0.55，自己跟车0.5）
      sell: {
        dashou:  0.55,
        genche:  0.5,
      }
    };

    /* ── 面板配置 ── */
    var panels = [
      {
        id: 'buy',
        input: document.getElementById('awBuyQty'),
        output: document.getElementById('awmBuyAmount'),
        root: document.getElementById('awmPanelBuy'),
      },
      {
        id: 'sell',
        input: document.getElementById('awmSellInput'),
        output: document.getElementById('awmSellAmount'),
        root: document.getElementById('awmPanelSell'),
      }
    ];

    // 校验 DOM 完整性
    for (var i = 0; i < panels.length; i++) {
      if (!panels[i].input || !panels[i].output || !panels[i].root) return;
    }

    /* ── 工具函数：安全取整（子弹数量必须是整数） ── */
    function sanitizeQty(raw) {
      var n = parseFloat(raw);
      if (isNaN(n) || n < 0) return 0;
      return Math.floor(n); // 向下取整，防止0.几发
    }

    /* ── 工具函数：金额格式化 ── */
    function formatMoney(amount) {
      return amount.toFixed(2) + ' 元';
    }

    /* ── 核心：计算单个面板金额 ── */
    function calcPanel(cfg) {
      var qty = sanitizeQty(cfg.input.value);
      var activeOpt = cfg.root.querySelector('.awm-option.active');
      if (!activeOpt) {
        cfg.output.textContent = formatMoney(0);
        return;
      }

      var optKey = activeOpt.dataset.option;   // genche / shanghao / dashou
      var unitPrice = 0;

      if (cfg.id === 'buy') {
        // 购买模式：查固定单价表
        unitPrice = PRICING.buy[optKey];
        if (unitPrice == null) unitPrice = 1.1; // 兜底
      } else {
        // 回收模式：查单价表（支持固定数值或阶梯函数）
        var sellPrice = PRICING.sell[optKey];
        unitPrice = typeof sellPrice === 'function' ? sellPrice(qty) : (sellPrice || 0);
      }

      var total = qty * unitPrice;
      cfg.output.textContent = formatMoney(total);

      Mode.Debug.log(CONFIG.debugTag,
        (cfg.id === 'buy' ? '购买' : '回收') +
        ' | 数量: ' + qty +
        ' | 方式: ' + optKey +
        ' | 单价: ' + unitPrice.toFixed(2) +
        ' | 总价: ' + total.toFixed(2));
    }

    /* ── 刷新所有面板（暴露给全局供 tab 切换调用） ── */
    window.refreshAllPanels = function() {
      for (var i = 0; i < panels.length; i++) {
        calcPanel(panels[i]);
      }
    };

    /* ── 绑定事件 ── */
    for (var i = 0; i < panels.length; i++) {
      var cfg = panels[i];

      // 输入变化：过滤非数字字符后计算
      cfg.input.addEventListener('input', (function(cfg_local) {
        return function() {
          // 只保留数字和小数点
          cfg_local.input.value = cfg_local.input.value.replace(/[^0-9\.]/g, '');
          calcPanel(cfg_local);
        };
      })(cfg));

      // 选项按钮点击（用事件委托优化）
      var opts = cfg.root.querySelectorAll('.awm-option');
      for (var j = 0; j < opts.length; j++) {
        opts[j].addEventListener('click', function(c) {
          return function() { calcPanel(c); };
        }(cfg));
      }
    }

    // 初始计算
    window.refreshAllPanels();
  }

  /* ── 自动初始化 ── */
  Mode.ready(init);

  /* ── 公开 API ── */
  return {
    init,
  };
})();