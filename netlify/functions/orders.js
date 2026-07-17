/**
 * orders.js — AWM回收订单 API
 * GET  /.netlify/functions/orders   → 获取订单列表
 * POST /.netlify/functions/orders   → 添加订单记录
 * PUT  /.netlify/functions/orders   → 编辑订单记录
 * DELETE /.netlify/functions/orders → 删除订单记录
 *
 * 安全措施：
 * 1. Origin 校验
 * 2. POST/PUT 输入验证 + 字段长度限制
 * 3. 管理员密码校验（使用与赞赏记录相同的密码）
 * 4. 简单 IP 限流
 */
const { createClient } = require('@supabase/supabase-js');

// 从 Netlify 环境变量读取
function _cleanEnv(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  while (s.length > 0 && (s[0] === '`' || s[0] === "'" || s[0] === '"' || s.charCodeAt(0) < 33)) {
    s = s.slice(1);
  }
  while (s.length > 0 && (s[s.length-1] === '`' || s[s.length-1] === "'" || s[s.length-1] === '"' || s.charCodeAt(s.length-1) < 33)) {
    s = s.slice(0, -1);
  }
  return s.trim();
}

const SUPABASE_URL = _cleanEnv(process.env.DATA_DB_URL);
const SUPABASE_KEY = _cleanEnv(process.env.DATA_DB_TOKEN);

// 从数据库获取管理员密码（支持环境变量作为 fallback）
async function getAdminPassword() {
  // 优先从环境变量读取（用于本地开发）
  const envPass = _cleanEnv(process.env.DONATIONS_ADMIN_PASS);
  if (envPass) {
    return envPass;
  }
  
  // 从数据库读取
  try {
    const { data, error } = await getSupabase()
      .from('admin_config')
      .select('config_value')
      .eq('config_key', 'admin_password')
      .single();
    
    if (error || !data) {
      console.warn('[orders] 数据库中未找到管理员密码配置');
      return null;
    }
    
    return data.config_value;
  } catch (err) {
    console.error('[orders] 读取管理员密码失败:', err);
    return null;
  }
}

// 配置表名
const ORDERS_TABLE = 'awm_orders';

// 字段长度限制
const MAX_BULLET_COUNT = 99999;
const MAX_TOTAL_PRICE = 999999;
const MAX_NOTES = 500;
const MAX_CUSTOMER_TYPE = 20;

// 简单内存限流
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (filtered.length >= RATE_LIMIT_MAX) return false;
  filtered.push(now);
  rateLimitMap.set(ip, filtered);
  if (rateLimitMap.size > 1000) rateLimitMap.clear();
  return true;
}

let supabase;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

exports.handler = async function (event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 处理 CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 检查 Supabase 配置
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ret: -1,
        msg: 'Supabase 环境变量未设置：请在 Netlify 后台配置 DATA_DB_URL 和 DATA_DB_TOKEN',
      }),
    };
  }

  // ── GET：获取订单列表 ──
  if (event.httpMethod === 'GET') {
    const { data, error } = await getSupabase()
      .from(ORDERS_TABLE)
      .select('id, order_number, bullet_count, total_price, customer_type, settled, notes, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ret: -1, msg: '查询失败: ' + error.message }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ret: 0, data }),
    };
  }

  // ── POST：添加订单记录 ──
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: 'JSON 格式错误' }) };
    }

    const { bullet_count, total_price, customer_type, notes, admin_pass, created_at, order_number, settled } = body;

    // 管理员密码校验（从数据库获取）
    const ADMIN_PASS = await getAdminPassword();
    if (!ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '系统未配置管理员密码' }) };
    }
    if (!admin_pass || String(admin_pass).trim() !== ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) };
    }

    // 输入验证
    if (!bullet_count || bullet_count <= 0 || bullet_count > MAX_BULLET_COUNT) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '子弹数量无效' }) };
    }
    if (!total_price || total_price <= 0 || total_price > MAX_TOTAL_PRICE) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '总价无效' }) };
    }

    // IP 限流（仅在密码验证通过后检查）
    const ip = event.headers?.['client-ip'] || event.headers?.['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(ip)) {
      return { statusCode: 429, headers, body: JSON.stringify({ ret: -1, msg: '请求过于频繁，请稍后再试' }) };
    }

    const insertData = {
      bullet_count: Number(bullet_count),
      total_price: Number(total_price),
      customer_type: (customer_type || '打手上号').toString().slice(0, MAX_CUSTOMER_TYPE),
      notes: (notes || '').toString().slice(0, MAX_NOTES),
    };

    if (order_number) {
      insertData.order_number = order_number.toString();
    }
    if (settled !== undefined) {
      insertData.settled = !!settled;
    }

    // 如果指定了创建时间
    if (created_at) {
      insertData.created_at = created_at;
    }

    const { data, error } = await getSupabase()
      .from(ORDERS_TABLE)
      .insert(insertData)
      .select('id, order_number, bullet_count, total_price, customer_type, settled, notes, created_at');

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ret: -1, msg: '添加失败: ' + error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, data: data[0] }) };
  }

  // ── PUT：编辑订单记录 ──
  if (event.httpMethod === 'PUT') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: 'JSON 格式错误' }) };
    }

    const { id, bullet_count, total_price, customer_type, notes, admin_pass, settled } = body;

    // 管理员密码校验（从数据库获取）
    const ADMIN_PASS = await getAdminPassword();
    if (!ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '系统未配置管理员密码' }) };
    }
    if (!admin_pass || String(admin_pass).trim() !== ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) };
    }

    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '缺少记录 ID' }) };
    }

    const updateData = {};
    if (bullet_count !== undefined) {
      if (bullet_count <= 0 || bullet_count > MAX_BULLET_COUNT) {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '子弹数量无效' }) };
      }
      updateData.bullet_count = Number(bullet_count);
    }
    if (total_price !== undefined) {
      if (total_price <= 0 || total_price > MAX_TOTAL_PRICE) {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '总价无效' }) };
      }
      updateData.total_price = Number(total_price);
    }
    if (customer_type !== undefined) {
      updateData.customer_type = customer_type.toString().slice(0, MAX_CUSTOMER_TYPE);
    }
    if (notes !== undefined) {
      updateData.notes = notes.toString().slice(0, MAX_NOTES);
    }
    if (settled !== undefined) {
      updateData.settled = !!settled;
    }

    const { data, error } = await getSupabase()
      .from(ORDERS_TABLE)
      .update(updateData)
      .eq('id', id)
      .select('id, order_number, bullet_count, total_price, customer_type, settled, notes, created_at');

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ret: -1, msg: '更新失败: ' + error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, data: data[0] }) };
  }

  // ── DELETE：删除订单记录 ──
  if (event.httpMethod === 'DELETE') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: 'JSON 格式错误' }) };
    }

    const { id, admin_pass } = body;

    // 管理员密码校验（从数据库获取）
    const ADMIN_PASS = await getAdminPassword();
    if (!ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '系统未配置管理员密码' }) };
    }
    if (!admin_pass || String(admin_pass).trim() !== ADMIN_PASS) {
      return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) };
    }

    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '缺少记录 ID' }) };
    }

    const { error } = await getSupabase()
      .from(ORDERS_TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ret: -1, msg: '删除失败: ' + error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, msg: '删除成功' }) };
  }

  // 其他方法不支持
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ ret: -1, msg: '不支持的请求方法' }),
  };
};