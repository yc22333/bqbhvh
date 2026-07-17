/**
 * server.js — 比奇堡报价单 · 汉堡云服务器主入口
 * 功能：Express 后端服务，替代所有 Netlify Functions + Supabase
 * 数据存储：SQLite（本地文件）
 * 
 * 使用方式：
 *   npm install
 *   node server.js
 *   访问 http://localhost:3000
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 中间件 ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 静态文件（前端页面） ──
app.use(express.static(__dirname));

/* ══════════════════════════════════════════════════════════════
   API 路由 — 替代所有 Netlify Functions
   ══════════════════════════════════════════════════════════════ */

// ── 管理员密码获取 ──
function getAdminPassword() {
  const row = db.get('admin_config', { config_key: 'admin_password' });
  return row ? row.config_value : null;
}

// ── 管理员密码验证中间件 ──
function requireAdmin(req, res, next) {
  const adminPass = req.body.admin_pass || req.query.admin_key || '';
  const realPass = getAdminPassword();
  if (!realPass || adminPass !== realPass) {
    return res.status(403).json({ ret: -1, msg: '管理员密码错误' });
  }
  next();
}

/* ─── ① 物品数据接口 ─── */
app.get('/api/items', (req, res) => {
  try {
    const { id, type, search, page, limit } = req.query;

    if (id) {
      const data = db.get('game_items', { id: parseInt(id) });
      if (!data) return res.status(404).json({ ret: -1, msg: '物品不存在' });
      return res.json({ ret: 0, data });
    }

    let allData = db.getAll('game_items', { orderBy: 'id', orderDir: 'asc' });

    if (type) {
      allData = allData.filter(item => item.primaryClass === type);
    }
    if (search) {
      const kw = search.toLowerCase();
      allData = allData.filter(item =>
        (item.objectName && item.objectName.toLowerCase().includes(kw)) ||
        (item.secondClass && item.secondClass.toLowerCase().includes(kw))
      );
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 1000, 5000);
    const offset = (pageNum - 1) * limitNum;
    const paged = allData.slice(offset, offset + limitNum);

    res.json({
      ret: 0,
      data: paged,
      total: allData.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    console.error('[items] 异常:', e.message);
    res.status(500).json({ ret: -1, msg: '服务器异常: ' + e.message });
  }
});

/* ─── ② 订单接口（AW子弹报价） ─── */
app.get('/api/orders', (req, res) => {
  try {
    const data = db.getAll('awm_orders', { orderBy: 'created_at', orderDir: 'desc' });
    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '查询失败: ' + e.message });
  }
});

app.post('/api/orders', requireAdmin, (req, res) => {
  try {
    const { bullet_count, total_price, customer_type, notes, order_number, settled, created_at } = req.body;

    if (!bullet_count || bullet_count <= 0 || bullet_count > 99999) {
      return res.status(400).json({ ret: -1, msg: '子弹数量无效' });
    }
    if (!total_price || total_price <= 0 || total_price > 999999) {
      return res.status(400).json({ ret: -1, msg: '总价无效' });
    }

    const insertData = {
      bullet_count: Number(bullet_count),
      total_price: Number(total_price),
      customer_type: (customer_type || '打手上号').toString().slice(0, 20),
      notes: (notes || '').toString().slice(0, 500),
    };
    if (order_number) insertData.order_number = order_number.toString();
    if (settled !== undefined) insertData.settled = settled ? 1 : 0;
    if (created_at) insertData.created_at = created_at;

    const data = db.insert('awm_orders', insertData);
    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '添加失败: ' + e.message });
  }
});

app.put('/api/orders', requireAdmin, (req, res) => {
  try {
    const { id, bullet_count, total_price, customer_type, notes, settled } = req.body;
    if (!id) return res.status(400).json({ ret: -1, msg: '缺少记录 ID' });

    const updateData = {};
    if (bullet_count !== undefined) {
      if (bullet_count <= 0 || bullet_count > 99999) return res.status(400).json({ ret: -1, msg: '子弹数量无效' });
      updateData.bullet_count = Number(bullet_count);
    }
    if (total_price !== undefined) {
      if (total_price <= 0 || total_price > 999999) return res.status(400).json({ ret: -1, msg: '总价无效' });
      updateData.total_price = Number(total_price);
    }
    if (customer_type !== undefined) updateData.customer_type = customer_type.toString().slice(0, 20);
    if (notes !== undefined) updateData.notes = notes.toString().slice(0, 500);
    if (settled !== undefined) updateData.settled = settled ? 1 : 0;

    db.update('awm_orders', id, updateData);
    const data = db.get('awm_orders', { id });
    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '更新失败: ' + e.message });
  }
});

app.delete('/api/orders', requireAdmin, (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ret: -1, msg: '缺少记录 ID' });
    db.delete('awm_orders', { id: parseInt(id) });
    res.json({ ret: 0, msg: '已删除' });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '删除失败: ' + e.message });
  }
});

/* ─── ③ 系统日志接口 ─── */
app.get('/api/logs', (req, res) => {
  try {
    const data = db.getAll('system_logs', { orderBy: 'created_at', orderDir: 'desc', limit: 500 });
    res.json({ ret: 0, data: data || [] });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.post('/api/logs', (req, res) => {
  try {
    const { tag, text, time } = req.body;
    if (!text) return res.status(400).json({ ret: -1, msg: '缺少日志内容' });

    const data = db.insert('system_logs', {
      tag: (tag || 'info').toString().slice(0, 20),
      text: text.toString().slice(0, 500),
      time: (time || new Date().toLocaleTimeString('zh-CN', { hour12: false })).toString().slice(0, 20),
    });

    // 清理超出限制的旧日志
    const allLogs = db.getAll('system_logs', { orderBy: 'id', orderDir: 'asc' });
    if (allLogs.length > 500) {
      const toDelete = allLogs.slice(0, allLogs.length - 500);
      toDelete.forEach(log => db.delete('system_logs', { id: log.id }));
    }

    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.delete('/api/logs', requireAdmin, (req, res) => {
  try {
    db.deleteAll('system_logs');
    res.json({ ret: 0, msg: '已清空' });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ─── ④ 赞赏记录接口 ─── */
app.get('/api/donations', (req, res) => {
  try {
    const data = db.getAll('donations', { orderBy: 'created_at', orderDir: 'desc' });
    res.json({ ret: 0, data: data || [] });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.post('/api/donations', requireAdmin, (req, res) => {
  try {
    const { nickname, amount, message, order_number } = req.body;

    if (!amount || amount <= 0 || amount > 999999) {
      return res.status(400).json({ ret: -1, msg: '金额无效' });
    }

    const insertData = {
      nickname: (nickname || '匿名').toString().slice(0, 20),
      amount: Number(amount),
      message: (message || '').toString().slice(0, 200),
      order_number: (order_number || '').toString(),
    };

    const data = db.insert('donations', insertData);
    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '添加失败: ' + e.message });
  }
});

app.delete('/api/donations', requireAdmin, (req, res) => {
  try {
    const { id } = req.query;
    if (id) {
      db.delete('donations', { id: parseInt(id) });
    } else {
      db.deleteAll('donations');
    }
    res.json({ ret: 0, msg: '已删除' });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ─── ⑤ 物品价格接口 ─── */
app.get('/api/item-prices', (req, res) => {
  try {
    const data = db.getAll('item_prices', { orderBy: 'updated_at', orderDir: 'desc' });
    res.json({ ret: 0, data: data || [] });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.post('/api/item-prices', (req, res) => {
  try {
    const { item_id, price, source } = req.body;
    if (!item_id || price === undefined) {
      return res.status(400).json({ ret: -1, msg: '参数不完整' });
    }
    const data = db.insert('item_prices', {
      item_id: parseInt(item_id),
      price: Number(price),
      source: (source || 'manual').toString().slice(0, 50),
    });
    res.json({ ret: 0, data });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ─── ⑥ API缓存读取接口 ─── */
app.get('/api/api-reader', (req, res) => {
  try {
    const endpoint = req.query.endpoint || '';
    if (!endpoint) {
      return res.status(400).json({ ret: -1, msg: '缺少 endpoint 参数' });
    }

    // 使用 cache_key 作为查询条件
    const data = db.find('api_cache', { cache_key: endpoint });
    if (!data) {
      return res.json({ ret: 404, msg: '暂无缓存数据', endpoint, cache_id: endpoint });
    }

    let parsedData = data.data;
    try {
      parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
    } catch (e) {
      // 保持原样
    }

    res.json({ ret: 0, msg: '读取成功', endpoint, cache_id: endpoint, updated_at: data.updated_at, data: parsedData });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ─── ⑦ 缓存管理接口 ─── */
app.get('/api/cache-manager', requireAdmin, (req, res) => {
  try {
    const data = db.getAll('api_cache');
    res.json({ ret: 0, data: data || [] });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.post('/api/cache-manager', requireAdmin, (req, res) => {
  try {
    const { id, data: cacheData } = req.body;
    if (!id) return res.status(400).json({ ret: -1, msg: '缺少缓存 ID' });

    const existing = db.find('api_cache', { cache_key: id });
    const strData = typeof cacheData === 'string' ? cacheData : JSON.stringify(cacheData);
    if (existing) {
      db.update('api_cache', existing.id, { data: strData, updated_at: new Date().toISOString() });
    } else {
      db.insert('api_cache', { cache_key: id, data: strData, updated_at: new Date().toISOString() });
    }
    res.json({ ret: 0, msg: '缓存已更新' });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ─── ⑧ 数据导入接口 ─── */
app.post('/api/import-items', requireAdmin, (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ ret: -1, msg: '缺少物品数据' });
    }
    let count = 0;
    items.forEach(item => {
      if (item.objectName) {
        const existing = db.find('game_items', { objectName: item.objectName });
        if (existing) {
          db.update('game_items', existing.id, item);
        } else {
          db.insert('game_items', item);
        }
        count++;
      }
    });
    res.json({ ret: 0, msg: `导入完成，共处理 ${count} 条` });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: '导入失败: ' + e.message });
  }
});

/* ─── ⑨ 管理员配置接口 ─── */
app.get('/api/admin-config', (req, res) => {
  try {
    const key = req.query.key || '';
    if (!key) {
      const data = db.getAll('admin_config');
      return res.json({ ret: 0, data });
    }
    const row = db.get('admin_config', { config_key: key });
    res.json({ ret: 0, data: row || null });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

app.post('/api/admin-config', requireAdmin, (req, res) => {
  try {
    const { config_key, config_value } = req.body;
    if (!config_key) return res.status(400).json({ ret: -1, msg: '缺少 config_key' });

    const existing = db.find('admin_config', { config_key });
    if (existing) {
      db.update('admin_config', existing.id, { config_value });
    } else {
      db.insert('admin_config', { config_key, config_value });
    }
    res.json({ ret: 0, msg: '配置已保存' });
  } catch (e) {
    res.status(500).json({ ret: -1, msg: e.message });
  }
});

/* ── 所有未匹配的 API 路由返回 404 ── */
app.all('/api/*', (req, res) => {
  res.status(404).json({ ret: -1, msg: 'API 接口不存在' });
});

/* ── SPA 兜底：所有非 API 路由返回 index.html ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ══════════════════════════════════════════════════════════════
   启动服务器
   ══════════════════════════════════════════════════════════════ */
db.init();
app.listen(PORT, () => {
  console.log('══════════════════════════════════════════════');
  console.log('  比奇堡报价单 · 汉堡云服务器版');
  console.log('  Version: 5.0.2');
  console.log('  Server:  http://localhost:' + PORT);
  console.log('  Data:    SQLite (server/data/database.sqlite)');
  console.log('══════════════════════════════════════════════');
});