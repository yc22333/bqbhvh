/**
 * donations.js — 赞赏记录 API（安全加固版）
 * GET  /.netlify/functions/donations   → 获取赞赏列表
 * POST /.netlify/functions/donations   → 添加赞赏记录
 *
 * 安全措施：
 * 1. Origin 校验 + 无 CORS 通配符
 * 2. POST 输入验证 + 字段长度限制
 * 3. 简单 IP 限流（每 IP 每分钟最多 1 条记录）
 */
const { createClient } = require('@supabase/supabase-js');

// 从 Netlify 环境变量读取（超级清理：移除所有空白、引号、反引号、控制字符）
function _cleanEnv(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  // 循环去除首尾引号、反引号、空格等（防止多重包裹）
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

let supabase;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

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
      console.warn('[donations] 数据库中未找到管理员密码配置');
      return null;
    }
    
    return data.config_value;
  } catch (err) {
    console.error('[donations] 读取管理员密码失败:', err);
    return null;
  }
}

// ==== 配置诊断 ====
// 请在 Netlify 后台 → Site settings → Environment variables 确认：
//   DATA_DB_URL   = https://你的项目.supabase.co
//   DATA_DB_TOKEN = sb_secret_...(service role key)
function getConfigDiagnosis() {
  return {
    URL_set: !!SUPABASE_URL,
    URL_value: SUPABASE_URL ? (SUPABASE_URL.slice(0, 30) + '...') : '(not set)',
    KEY_set: !!SUPABASE_KEY,
    KEY_length: SUPABASE_KEY ? SUPABASE_KEY.length : 0,
    KEY_prefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
  };
}

// 配置表名
const DONATIONS_TABLE = 'donations';

// ==== 安全配置 ====
const ALLOWED_ORIGINS = [
  'localhost',
  '127.0.0.1',
  // 添加你的生产域名
];

// 字段长度限制
const MAX_NICKNAME = 20;
const MAX_MESSAGE = 200;
const MAX_AMOUNT = 999999;

// 简单内存限流（Netlify 单实例够用；如需更严格请用 Redis/Blob）
const rateLimitMap = new Map(); // IP -> 时间戳数组
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 分钟窗口
const RATE_LIMIT_MAX = 10; // 窗口内最多 10 次请求

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (filtered.length >= RATE_LIMIT_MAX) return false;
  filtered.push(now);
  rateLimitMap.set(ip, filtered);
  // 定期清理过期条目
  if (rateLimitMap.size > 1000) rateLimitMap.clear();
  return true;
}

function isAllowedOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const referer = event.headers?.referer || event.headers?.Referer || '';
  const host = event.headers?.host || event.headers?.Host || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) return true;
  for (const val of [origin, referer]) {
    if (!val) continue;
    try {
      const h = new URL(val).hostname;
      if (ALLOWED_ORIGINS.some(d => h === d || h.endsWith('.' + d))) return true;
    } catch {}
  }
  const hasCustom = ALLOWED_ORIGINS.some(d => d !== 'localhost' && d !== '127.0.0.1');
  if (!hasCustom) return true;
  return false;
}

exports.handler = async function (event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || 'same-origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  // ✅ 特殊调试路径：GET /?debug=1 → 超级详细的网络诊断
  if (event.httpMethod === 'GET' && event.queryStringParameters?.debug === '1') {
    const diag = {
      url_clean: SUPABASE_URL || '(empty)',
      url_length: SUPABASE_URL.length,
      url_char_codes: SUPABASE_URL ? Array.from(SUPABASE_URL).map(c => c.charCodeAt(0) + ':' + c).join(' | ') : '(empty)',
      key_set: !!SUPABASE_KEY,
      key_length: SUPABASE_KEY.length,
      key_starts_with: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 20) : '(empty)',
    };

    // 1. 测试 DNS 解析
    let dnsTest = 'skipped';
    try {
      const dns = require('dns');
      const hostname = SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0];
      diag.hostname = hostname;
      const result = await new Promise((resolve, reject) => {
        dns.lookup(hostname, (err, address, family) => {
          if (err) reject(err);
          else resolve({ address, family });
        });
      });
      dnsTest = 'OK: ' + JSON.stringify(result);
    } catch (e) {
      dnsTest = 'FAIL: ' + e.message;
    }
    diag.dns = dnsTest;

    // 2. 测试 TCP 连接（用 fetch 发一个 HEAD 请求）
    let tcpTest = 'skipped';
    if (SUPABASE_URL) {
      try {
        const resp = await fetch(SUPABASE_URL + '/rest/v1/', {
          method: 'GET',
          headers: { 'apikey': SUPABASE_KEY },
        });
        tcpTest = 'HTTP ' + resp.status;
      } catch (e) {
        tcpTest = 'FAIL: ' + e.message;
        if (e.cause) tcpTest += ' | cause: ' + e.cause.message;
      }
    }
    diag.tcp_http = tcpTest;

    // 3. 用 Supabase 客户端测试查询
    let clientTest = 'skipped';
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const testClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await testClient.from('donations').select('*').limit(1);
        if (error) {
          clientTest = 'QUERY ERROR: ' + error.message + ' (code: ' + (error.code || 'none') + ', hint: ' + (error.hint || 'none') + ')';
        } else {
          clientTest = 'SUCCESS: 查询到 ' + (data ? data.length : 0) + ' 条记录';
        }
      } catch (e) {
        clientTest = 'ERROR: ' + e.message;
        if (e.cause) clientTest += ' | cause: ' + e.cause.message;
      }
    }
    diag.supabase_client = clientTest;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ret: 0, debug: diag }, null, 2),
    };
  }

  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '拒绝访问：来源不受信任' }) };
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // ==== 诊断：检查 Supabase 配置 ====
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ret: -1,
          msg: 'Supabase 环境变量未设置：请在 Netlify 后台配置 DATA_DB_URL 和 DATA_DB_TOKEN',
          debug: getConfigDiagnosis(),
        }),
      };
    }

    // ── GET：获取赞赏记录 ──
    if (event.httpMethod === 'GET') {
      console.log('[donations] Supabase URL:', SUPABASE_URL.slice(0, 35) + '...');
      console.log('[donations] Supabase KEY prefix:', SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)');

      const { data, error } = await getSupabase()
        .from(DONATIONS_TABLE)
        .select('id, nickname, amount, message, settled, created_at, order_number, customer_type, bullet_count, total_price')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[donations] Supabase 错误:', error.message, '| code:', error.code);
        let friendlyMsg = '数据库查询失败';
        if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('relation')) {
          friendlyMsg = 'donations 表不存在！请在 Supabase SQL Editor 中运行建表脚本';
        } else if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          friendlyMsg = '权限不足：请使用 service_role key，或为 anon key 添加 RLS 策略';
        }
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            ret: -1,
            msg: friendlyMsg,
            debug: {
              url: SUPABASE_URL.slice(0, 35) + '...',
              keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
              supabaseCode: error.code || '(none)',
              supabaseDetails: error.details || error.message,
            },
          }),
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, data }) };
    }

    // ── 获取管理员密码（在所有需要密码的操作之前）──
    const ADMIN_PASS = await getAdminPassword();

    // ── POST：添加赞赏记录（仅站长可用，需提供 admin_pass） ──
    if (event.httpMethod === 'POST') {
      // 解析并验证输入
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '请求体格式错误' }) }; 
      }

      let { nickname, amount, message, admin_pass, customer_type, bullet_count, total_price, order_number } = body || {};

      // 🔒 管理员密码校验：未配置密码或密码错误都拒绝（从数据库获取）
      if (!ADMIN_PASS) {
        return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '系统未配置管理员密码，请在数据库 admin_config 表中设置' }) }; 
      }
      if (!admin_pass || String(admin_pass).trim() !== ADMIN_PASS) {
        return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) }; 
      }

      // IP 限流（密码验证通过后才检查，避免误拦截正常登录）
      const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || event.headers['x-nf-client-connection-ip']
        || 'unknown';
      if (!checkRateLimit(clientIP)) {
        return { statusCode: 429, headers, body: JSON.stringify({ ret: -1, msg: '请求过于频繁，请稍后再试' }) }; 
      }

      // 字段验证
      if (amount == null || isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '金额无效' }) };
      }
      if (nickname && typeof nickname === 'string' && nickname.length > MAX_NICKNAME) {
        nickname = nickname.slice(0, MAX_NICKNAME);
      }
      if (message && typeof message === 'string' && message.length > MAX_MESSAGE) {
        message = message.slice(0, MAX_MESSAGE);
      }

      const insertData = {
        nickname: (nickname || customer_type || '匿名用户').toString().slice(0, MAX_NICKNAME),
        amount: Number(amount),
        message: (message || (bullet_count ? String(bullet_count) : '')).toString().slice(0, MAX_MESSAGE),
        settled: body.settled === true || body.settled === 'true',
        customer_type: (customer_type || nickname || '打手上号').toString().slice(0, 20),
        bullet_count: bullet_count !== undefined ? Number(bullet_count) : null,
        total_price: total_price !== undefined ? Number(total_price) : null,
        order_number: (order_number || '').toString().slice(0, 30) || null,
      };
      // 支持手动指定创建时间
      if (body.created_at) {
        const customDate = new Date(body.created_at);
        if (!isNaN(customDate.getTime())) {
          insertData.created_at = customDate.toISOString();
        }
      }

      const { data, error } = await getSupabase()
        .from(DONATIONS_TABLE)
        .insert([insertData])
        .select('id, nickname, amount, message, settled, created_at, order_number, customer_type, bullet_count, total_price');

      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, data }) };
    }

    // ── PUT：编辑赞赏记录（需要 admin_pass） ──
    if (event.httpMethod === 'PUT') {
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '请求体格式错误' }) };
      }

      let { id, nickname, amount, message, admin_pass, customer_type, bullet_count, total_price, order_number } = body || {};

      // 管理员密码校验
      if (!ADMIN_PASS) {
        return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '系统未配置管理员密码' }) };
      }
      if (!admin_pass || String(admin_pass).trim() !== ADMIN_PASS) {
        return { statusCode: 403, headers, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) };
      }

      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '缺少记录 ID' }) };
      }

      // 字段验证
      if (amount == null || isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '金额无效' }) };
      }

      const updateData = {
        nickname: (nickname || customer_type || '匿名用户').toString().slice(0, MAX_NICKNAME),
        amount: Number(amount),
        message: (message || (bullet_count ? String(bullet_count) : '')).toString().slice(0, MAX_MESSAGE),
        customer_type: (customer_type || nickname || '打手上号').toString().slice(0, 20),
        bullet_count: bullet_count !== undefined ? Number(bullet_count) : null,
        total_price: total_price !== undefined ? Number(total_price) : null,
        order_number: (order_number || '').toString().slice(0, 30) || null,
      };
      if (body.settled !== undefined) {
        updateData.settled = body.settled === true || body.settled === 'true';
      }

      const { data, error } = await getSupabase()
        .from(DONATIONS_TABLE)
        .update(updateData)
        .eq('id', id)
        .select('id, nickname, amount, message, settled, created_at');

      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, data }) };
    }

    // ── DELETE：删除赞赏记录（需要 admin_pass） ──
    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ ret: -1, msg: '请求体格式错误' }) };
      }

      let { id, admin_pass } = body || {};

      // 管理员密码校验
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
        .from(DONATIONS_TABLE)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ret: 0, msg: '删除成功' }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ ret: -1, msg: 'Method Not Allowed' }) };
  } catch (err) {
    console.error('[donations] 未捕获异常:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ret: -1,
        msg: err.message,
        debug: {
          stack: err.stack?.slice(0, 300) || '(无调用栈)',
          url: SUPABASE_URL ? SUPABASE_URL.slice(0, 35) + '...' : '(not set)',
          keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
        },
      }),
    };
  }
};