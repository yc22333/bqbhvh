// ============================================================
// ditu.js — 三角洲地图工具
// ============================================================
(function() {
  'use strict';

  // 等待DOM加载完成
  document.addEventListener('DOMContentLoaded', function() {
    initDitu();
  });

  // 初始化地图工具
  function initDitu() {
    const container = document.getElementById('dituContainer');
    if (!container) {
      console.error('❌ 地图容器未找到');
      return;
    }

    // 三角洲官方地图工具链接
    const mapUrl = 'https://df.qq.com/cp/a20240729directory/';
    
    // 直接嵌入 iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'ditu-iframe';
    iframe.src = mapUrl;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('scrolling', 'no'); // 隐藏滚动条
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.overflow = 'hidden'; // 隐藏滚动条
    
    container.innerHTML = '';
    container.appendChild(iframe);

    console.log('✅ 地图工具已加载');
  }

})();