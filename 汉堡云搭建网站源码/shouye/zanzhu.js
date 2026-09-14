/* ============================================================
   zanzhu.js — 首页状态管理
   功能: 服务器随机状态
   ============================================================ */

const Zanzhu = (() => {
  'use strict';

 /* ========== 状态配置 ========== */
  const STATUSES = [
    { name: "在线中", class: "status-online" },
    { name: "摸鱼中", class: "status-idle" },
    { name: "维护中", class: "status-maintenance" },
    { name: "忙碌中", class: "status-busy" },
    { name: "摆烂中", class: "status-lazy" },
    { name: "神秘中", class: "status-mysterious" },
    { name: "派大星附体", class: "status-patrick" },
    { name: "海绵宝宝附体", class: "status-sponge" },
    { name: "痞老板附体", class: "status-plankton" },
    { name: "蟹老板附体", class: "status-crab" },
  ];

  /* ========== 随机选择状态 ========== */
  function randomStatus() {
    const index = Math.floor(Math.random() * STATUSES.length);
    return STATUSES[index];
  }

  /* ========== 随机进度条 ========== */
  function randomProgress() {
    // 生成 10% 到 100% 的随机数
    return Math.floor(Math.random() * 91) + 10;
  }
  
  function updateProgressBars() {
    const barFills = document.querySelectorAll('.bar-fill');
    barFills.forEach((bar) => {
      const randomWidth = randomProgress();
      bar.style.width = randomWidth + '%';
    });
  }
  
  /* ========== 初始化 ========== */
  function init() {
    const statusEl = document.getElementById("serverStatusName");
    if (statusEl) {
      const status = randomStatus();
      statusEl.textContent = status.name;
      statusEl.classList.add(status.class);
    }
    
    // 更新进度条
    updateProgressBars();
    
    // 微信弹窗和鼠鼠聚集地跳转
    initInteractions();
    
    // 广告位轮播
    initAdCarousel();
  }
  
  /* ========== 交互功能 ========== */
  function initInteractions() {
    // 微信弹窗
    const weixinBtn = document.getElementById("weixinBtn");
    const weixinModal = document.getElementById("weixinModal");
    const weixinModalClose = document.getElementById("weixinModalClose");
    
    if (weixinBtn && weixinModal && weixinModalClose) {
      // 点击按钮打开弹窗
      weixinBtn.addEventListener("click", () => {
        weixinModal.style.display = "flex";
      });
      
      // 点击关闭按钮
      weixinModalClose.addEventListener("click", () => {
        weixinModal.style.display = "none";
      });
      
      // 点击弹窗外区域关闭
      weixinModal.addEventListener("click", (e) => {
        if (e.target === weixinModal) {
          weixinModal.style.display = "none";
        }
      });
    }
    
    // 鼠鼠聚集地跳转（新标签页）
    const kookBtn = document.getElementById("kookBtn");
    if (kookBtn) {
      kookBtn.addEventListener("click", () => {
        window.open("https://kook.vip/qXZTr2", "_blank");
      });
    }
  }
  
  /* ========== 轮播图 ========== */
  function initAdCarousel() {
    const adItems = document.querySelectorAll('.lunbo-item');
    if (adItems.length <= 1) return;
    
    // 确保第一个轮播项可见（默认 active）
    let currentIndex = 0;
    adItems[currentIndex].classList.add('active');
    
    // 自动轮播，每2.5秒切换一次
    setInterval(() => {
      // 移除当前active
      adItems[currentIndex].classList.remove('active');
      
      // 下一个索引
      currentIndex = (currentIndex + 1) % adItems.length;
      
      // 添加active
      adItems[currentIndex].classList.add('active');
    }, 2500);
  }

  /* ========== 自动初始化 ========== */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ========== 公开 API ========== */
  return {
    init,
  };
})();