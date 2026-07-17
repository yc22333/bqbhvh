// ============================================================
// zhizao.js — 今日制造功能
// 数据来源: API 实时获取（Mode.SjzApi.manufacture）
// ============================================================
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 [Craft] 今日制造模块已加载');
    renderCraftItems();
  });

  // 👇 新加这段
  if (typeof Mode !== 'undefined') {
    Mode.Zhizao = {
      init: function() {
        renderCraftItems();
      }
    };
  }

  // 渲染今日制造物品
  function renderCraftItems() {
    console.log('🔨 [Craft] 开始渲染今日制造...');
    
    var grid = document.getElementById('craftGrid');
    if (!grid) {
      console.error('❌ [Craft] craftGrid 元素未找到');
      return;
    }

    // 工作台列表（从左到右：1技术中心 2工作台 3制药台 4防具台）
    var workshops = [
      { id: 1, name: '技术中心' },
      { id: 2, name: '工作台' },
      { id: 3, name: '制药台' },
      { id: 4, name: '防具台' }
    ];

    // 先显示加载占位
    var html = '';
    workshops.forEach(function(ws) {
      html += '<div class="craft-item"><div class="craft-empty">' + ws.name + '<br>加载中...</div></div>';
    });
    grid.innerHTML = html;

    // 从 API 获取制造数据（单次请求，返回全部工作台数据）
    if (Mode.SjzApi && typeof Mode.SjzApi.manufacture === 'function') {
      Mode.SjzApi.manufacture().then(function(allData) {
        renderManufactureData(allData, workshops, grid);
      }).catch(function(err) {
        console.warn('[Craft] 获取制造数据失败:', err.message);
        renderManufactureData(null, workshops, grid);
      });
    } else {
      renderManufactureData(null, workshops, grid);
    }
  }

  // 渲染制造数据（兼容多种 API 返回格式）
  function renderManufactureData(allData, workshops, grid) {
    // 🔍 打印真实数据结构
    console.log('[Craft] 🔍 allData 完整数据:', JSON.stringify(allData, null, 2));
    console.log('[Craft] 🔍 allData 类型:', typeof allData, '是数组:', Array.isArray(allData));
    if (allData && typeof allData === 'object') {
      console.log('[Craft] 🔍 键列表:', Object.keys(allData));
    }

    var html = '';

    workshops.forEach(function(ws) {
      // 从 allData 中提取对应工作台的数据，兼容多种键名格式
      var wsData = null;
      if (allData && typeof allData === 'object') {
        // 格式1: 数字键 {1: [...], 2: [...]}
        if (allData[ws.id] !== undefined) {
          wsData = allData[ws.id];
        }
        // 格式2: 字符串键 {'1': [...], '2': [...]}
        else if (allData[String(ws.id)] !== undefined) {
          wsData = allData[String(ws.id)];
        }
        // 格式3: data 键 {data: {1: [...], 2: [...]}}
        else if (allData.data && allData.data[ws.id] !== undefined) {
          wsData = allData.data[ws.id];
        }
        // 格式4: 数组 [{workshop:1, items:[...]}, ...]
        else if (Array.isArray(allData)) {
          var found = allData.filter(function(item) {
            return item.workshop === ws.id || item.t === ws.id || item.id === ws.id;
          });
          if (found.length > 0) {
            wsData = found[0].items || found[0].data || found[0].list || [];
          }
        }
        // 格式5: {code:0, data: [{workshop:1, items:[...]}, ...]}
        else if (allData.data && Array.isArray(allData.data)) {
          var found = allData.data.filter(function(item) {
            return item.workshop === ws.id || item.t === ws.id || item.id === ws.id;
          });
          if (found.length > 0) {
            wsData = found[0].items || found[0].data || found[0].list || [];
          }
        }
      }

      // 确保 wsData 是数组
      var items = Array.isArray(wsData) ? wsData : [];

      if (items.length > 0) {
        // 找到利润最高的
        var best = items[0];
        var maxProfit = items[0].price || 0;
        items.forEach(function(item) {
          var p = item.price || 0;
          if (p > maxProfit) {
            maxProfit = p;
            best = item;
          }
        });

        html += '<div class="craft-item">';
        html += '  <div class="craft-item-header">';
        html += '    <img class="craft-item-img" src="' + best.pic + '" alt="" style="width:48px;height:48px;">';
        html += '    <div class="craft-item-info">';
        html += '      <div class="craft-item-name">' + best.name + '</div>';
        html += '      <div class="craft-item-profit ' + (best.price >= 0 ? 'profit-up' : 'profit-down') + '">价值: ' + best.price + '</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      } else {
        html += '<div class="craft-item"><div class="craft-empty">' + ws.name + '<br>无数据</div></div>';
      }
    });
    grid.innerHTML = html;
    console.log('✅ [Craft] 渲染完成');
  }

})();