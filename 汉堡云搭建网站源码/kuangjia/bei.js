/* ============================================================
   bei.js — 粒子背景系统
   功能: 全屏漂浮粒子 + 鼠标靠近时施加排斥力
   依赖: mode.js (Mode 命名空间)
   [CREATED: 2026-06-07] [READ-ONLY AFTER FINALIZATION]
   ============================================================ */

const Bei = (() => {
  'use strict';

  /* ── 配置 ── */
  const CONFIG = {
    count:       80,       // 粒子数量
    repRadius:   120,      // 鼠标排斥半径 (px)
    repForce:    3,        // 排斥力度
    minSize:     1,        // 最小粒子尺寸
    maxSize:     4,        // 最大粒子尺寸
    minOpacity:  0.15,     // 最小透明度
    maxOpacity:  0.6,      // 最大透明度
    speed:       0.4,      // 漂浮速度系数
    color:       '255,255,255'  // 粒子颜色 (RGB)
  };

  /* ── 状态 ── */
  let canvas, ctx;
  let particles = [];
  let mouse = { x: null, y: null };
  let animId = null;

  /* ── 工具 ── */
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  /* ── 初始化 ── */
  function init() {
    canvas = document.getElementById('bei-canvas');
    if (!canvas) { Mode.Debug.error('Bei', '未找到 #bei-canvas'); return; }

    ctx = canvas.getContext('2d');
    resize();
    spawn();
    bind();
    loop();

    Mode.Debug.log('Bei', '粒子背景已启动 (' + CONFIG.count + ' 粒子)');
  }

  /* ── 尺寸自适应 ── */
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /* ── 生成粒子 ── */
  function spawn() {
    particles = [];
    for (let i = 0; i < CONFIG.count; i++) {
      particles.push({
        x:      rand(0, canvas.width),
        y:      rand(0, canvas.height),
        size:   rand(CONFIG.minSize, CONFIG.maxSize),
        vx:     rand(-CONFIG.speed, CONFIG.speed),
        vy:     rand(-CONFIG.speed, CONFIG.speed),
        alpha:  rand(CONFIG.minOpacity, CONFIG.maxOpacity)
      });
    }
  }

  /* ── 事件绑定 ── */
  function bind() {
    window.addEventListener('resize', () => {
      resize();
      // 窗口改变时重新分布粒子位置
      particles.forEach(p => {
        p.x = Math.min(p.x, canvas.width);
        p.y = Math.min(p.y, canvas.height);
      });
    });

    document.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    document.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    // 触摸设备支持
    document.addEventListener('touchmove', e => {
      const t = e.touches[0];
      mouse.x = t.clientX;
      mouse.y = t.clientY;
    }, { passive: true });

    document.addEventListener('touchend', () => {
      mouse.x = null;
      mouse.y = null;
    });

    // 页面不可见时暂停动画（节省性能）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏时停止动画循环
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        // 页面重新可见时恢复动画
        if (!animId) {
          loop();
        }
      }
    });
  }

  /* ── 动画主循环 ── */
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── 绘制普通粒子 ──
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      /* 自由漂浮 */
      p.x += p.vx;
      p.y += p.vy;

      /* 鼠标排斥 */
      if (mouse.x !== null && mouse.y !== null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.repRadius && dist > 0.5) {
          const force = (CONFIG.repRadius - dist) / CONFIG.repRadius;
          p.x += (dx / dist) * force * CONFIG.repForce;
          p.y += (dy / dist) * force * CONFIG.repForce;
        }
      }

      /* 边界循环（从一边出去，另一边进来） */
      const margin = CONFIG.maxSize * 3;
      if (p.x < -margin) p.x = canvas.width  + margin;
      if (p.x > canvas.width  + margin) p.x = -margin;
      if (p.y < -margin) p.y = canvas.height + margin;
      if (p.y > canvas.height + margin) p.y = -margin;

      /* 绘制粒子 */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + CONFIG.color + ',' + p.alpha + ')';
      ctx.fill();
    }

    animId = requestAnimationFrame(loop);
  }

  /* ── 公开 API ── */
  return {
    init: init,
    config: CONFIG
  };
})();

/* 页面就绪后自动启动 */
Mode.ready(function () {
  Bei.init();
});