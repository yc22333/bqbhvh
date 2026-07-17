/**
 * Netlify Function — 数据源转发接口（简化版）
 *
 * 仅供 cache-manager 调用上游API时使用（积分消耗来源）。
 * 已移除：内存缓存、请求窗口、日期验证函数。
 * 保留：Blob 共享缓存 + CDN 缓存头。
 *
 * 配置方式：在 Netlify 后台 → Site settings → Environment variables
 *   DATA_SOURCE_TOKEN = 你的 orzice.com API 密钥
 *   ADMIN_KEY          = 管理员密钥（用于手动刷新缓存）
 *   POINTS_LOG_STORE   = 积分日志存储名称（默认：points-log）
 */
const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');

const TOKEN = process.env.DATA_SOURCE_TOKEN;
const BASE_URL = process.env.DATA_API_BASE || 'https://orzice.com/workApi';
const ADMIN_KEY = process.env.ADMIN_KEY;
const POINTS_LOG_STORE = process.env.POINTS_LOG_STORE || 'points-log';

// Supabase 客户端
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

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

// ═════════════════════════════════════════════
// 💰 积分消耗监控日志系统（双写：Netlify Blobs + Supabase）
// ═════════════════════════════════════════════
async function logPointsConsumption(endpoint, timestamp, userAgent, ip) {
  try {
    const logEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      endpoint: endpoint,
      timestamp: timestamp,
      time_str: new Date(timestamp).toISOString(),
      user_agent: userAgent || 'unknown',
      ip: ip || 'unknown',
      type: 'api_call',
      cost: 1, // 每次API调用消耗1积分
    };
    
    // ── 写入 Netlify Blobs（兼容旧版） ──
    try {
      const store = getStore(POINTS_LOG_STORE);
      let logs = [];
      try {
        const existing = await store.getJSON('consumption_log');
        if (existing && Array.isArray(existing.logs)) {
          logs = existing.logs;
        }
      } catch (e) {
        // 首次创建
      }
      
      logs.unshift(logEntry);
      if (logs.length > 100) {
        logs = logs.slice(0, 100);
      }
      
      await store.setJSON('consumption_log', {
        last_updated: Date.now(),
        total_calls: logs.length,
        logs: logs,
      });
    } catch (e) {
      console.error('[proxy] ⚠️ Blobs积分日志写入失败（不影响主流程）:', e.message);
    }
    
    // ── 写入 Supabase（与 cache-manager 同步） ──
    try {
      // 读取现有 Supabase 积分日志
      let logs = [];
      let totalCalls = 0;
      let totalPointsConsumed = 0;
      let initialPoints = 0;
      try {
        const { data: existing, error } = await getSupabase()
          .from('api_cache')
          .select('data')
          .eq('id', 'points_log')
          .single();
        
        if (!error && existing && existing.data && Array.isArray(existing.data.logs)) {
          logs = existing.data.logs;
          totalCalls = existing.data.total_calls || logs.length;
          totalPointsConsumed = existing.data.total_points_consumed || 0;
          initialPoints = existing.data.initial_points || 0;
        }
      } catch (e) {
        // 首次创建
      }
      
      // 添加新日志（保留最近100条）
      logs.unshift(logEntry);
      if (logs.length > 100) {
        logs = logs.slice(0, 100);
      }
      
      // 保存到 Supabase
      const { error: upsertError } = await getSupabase()
        .from('api_cache')
        .upsert({
          id: 'points_log',
          data: {
            initial_points: initialPoints,
            last_updated: Date.now(),
            total_calls: totalCalls + 1,
            total_points_consumed: totalPointsConsumed + 1,
            logs: logs,
          },
        });
      
      if (upsertError) {
        console.error('[proxy] ❌ Supabase积分日志写入失败:', upsertError.message);
      }
    } catch (e) {
      console.error('[proxy] ⚠️ Supabase积分日志写入异常（不影响主流程）:', e.message);
    }
    
    console.log(`[proxy] 💰 积分消耗已记录 | ${endpoint} | ${logEntry.time_str}`);
    return true;
  } catch (e) {
    console.error('[proxy] ❌ 积分日志写入失败:', e.message);
    return false;
  }
}

// 获取积分消耗日志统计
async function getPointsLogStats() {
  try {
    const store = getStore(POINTS_LOG_STORE);
    const data = await store.getJSON('consumption_log');
    if (!data) return { total_calls: 0, logs: [] };
    
    // 统计最近24小时的消耗
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentLogs = data.logs.filter(log => log.timestamp > last24h);
    
    // 统计各接口消耗次数
    const endpointStats = {};
    data.logs.forEach(log => {
      if (!endpointStats[log.endpoint]) {
        endpointStats[log.endpoint] = 0;
      }
      endpointStats[log.endpoint]++;
    });
    
    return {
      total_calls: data.total_calls,
      last_24h_calls: recentLogs.length,
      endpoint_stats: endpointStats,
      last_updated: data.last_updated,
      logs: data.logs.slice(0, 20), // 只返回最近20条
    };
  } catch (e) {
    console.error('[proxy] ❌ 积分日志读取失败:', e.message);
    return { total_calls: 0, logs: [], error: e.message };
  }
}

// ==== 接口白名单 ====
const ALLOWED_ENDPOINTS = [
  // 卡战备V3
  '/v1/sjz_api/jzv3_zb',
  // 今日制造Pro
  '/v1/sjz_api/manufacturePro',
  // 每日密码
  '/v1/sjz_api/map_pwd',
];

// 工具：构造缓存头（CDN 缓存+浏览器缓存）
function buildCacheHeaders() {
  return {
    'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=86400',
    'Netlify-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    'Netlify-Cache-Key': 'proxy-api',
  };
}

exports.handler = async function (event) {
  // 基础响应头
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || 'same-origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  // ==== 安全检查 1：验证来源 ====
  if (!isAllowedOrigin(event)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ret: -1, msg: '拒绝访问：来源不受信任' }),
    };
  }

  // OPTIONS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  // ==== 安全检查 2：只允许 GET ====
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '仅支持 GET 请求' }),
    };
  }

  // ==== 安全检查 3：DATA_SOURCE_TOKEN 是否已配置 ====
  if (!TOKEN) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: -1,
        msg: 'DATA_SOURCE_TOKEN 未设置：请在 Netlify 后台配置环境变量',
      }),
    };
  }

  // ==== 解析请求 path ====
  const path = event.queryStringParameters?.path || '';
  if (!path) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '缺少 path 参数' }),
    };
  }

  const qIdx = path.indexOf('?');
  const endpoint = qIdx === -1 ? path : path.slice(0, qIdx);

  // ==== 安全检查 4：接口白名单 ====
  if (!isAllowedPath(endpoint)) {
    return {
      statusCode: 403,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '拒绝访问：API 端点不在白名单内' }),
    };
  }

  const cacheKey = 'v1:' + path;

  // ══════════════════════════════════════════════════
  // 🟢 检查 Netlify Blob 缓存（全球共享）
  // ══════════════════════════════════════════════════
  let cached = null;
  try {
    const store = getStore('api-cache');
    cached = await store.getJSON(cacheKey);

    if (cached && (Date.now() - cached.ts) < 86400000) { // 1天以内
      const age = Math.floor((Date.now() - cached.ts) / 1000);
      console.log(`[proxy] ✅ Blob 缓存命中 | ${endpoint} | age=${age}s`);
      return {
        statusCode: 200,
        headers: { ...baseHeaders, ...buildCacheHeaders(), 'X-Cache': 'HIT-blob', 'X-Cache-Age': String(age) },
        body: cached.body,
      };
    }
  } catch (blobErr) {
    console.error('[proxy] ❌ Blob 读取异常:', blobErr.message);
  }

  // ══════════════════════════════════════════════════
  // 🔴 缓存未命中，检查管理员权限
  // ══════════════════════════════════════════════════
  const adminKey = event.queryStringParameters?.admin_key || '';
  
  if (!ADMIN_KEY) {
    return {
      statusCode: 503,
      headers: baseHeaders,
      body: JSON.stringify({ 
        ret: -1, 
        msg: '缓存未命中且未配置管理员密钥，无法获取数据。请联系管理员刷新缓存。' 
      }),
    };
  }
  
  const isAdmin = adminKey === ADMIN_KEY;
  
  if (!isAdmin) {
    // 普通用户：有缓存就返回旧数据，没有就报错
    if (cached) {
      console.log(`[proxy] ⚠️ 返回旧缓存数据（用户无权访问API） | ${endpoint}`);
      return {
        statusCode: 200,
        headers: { ...baseHeaders, 'X-Cache': 'STALE-USER' },
        body: cached.body,
      };
    }
    
    return {
      statusCode: 503,
      headers: baseHeaders,
      body: JSON.stringify({ 
        ret: -1, 
        msg: '数据暂不可用，请稍后再试或联系管理员刷新缓存。',
        endpoint: endpoint,
        hint: '管理员可使用 admin_key 参数强制刷新',
      }),
    };
  }
  
  // 🔑 管理员：允许访问API
  console.log(`[proxy] 🔑 管理员授权访问API | ${endpoint}`);

  // ══════════════════════════════════════════════════
  // 🔴 管理员访问API（消耗积分）
  // ══════════════════════════════════════════════════
  const apiCallStartTime = Date.now();
  
  const params = qIdx === -1 ? {} : Object.fromEntries(new URLSearchParams(path.slice(qIdx + 1)));
  delete params.token;
  params.token = TOKEN;

  const targetUrl = `${BASE_URL}${endpoint}?${new URLSearchParams(params)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let resp;
  try {
    resp = await fetch(targetUrl, { signal: controller.signal });
  } catch (fetchErr) {
    clearTimeout(timeout);
    return {
      statusCode: 502,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '上游API请求失败: ' + fetchErr.message }),
    };
  }

  clearTimeout(timeout);

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error(`[proxy] ❌ 上游API返回错误 | ${endpoint} | status=${resp.status}`);
    return {
      statusCode: resp.status,
      headers: baseHeaders,
      body: errBody || JSON.stringify({ ret: -1, msg: '上游API返回错误' }),
    };
  }

  // 读取响应数据
  let bodyText;
  try {
    bodyText = await resp.text();
  } catch (readErr) {
    console.error('[proxy] ❌ 读取响应体失败:', readErr.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '读取响应失败' }),
    };
  }
  
  // ══════════════════════════════════════════════════
  // 💰 记录积分消耗日志
  // ══════════════════════════════════════════════════
  const userAgent = event.headers?.['user-agent'] || event.headers?.UserAgent || '';
  const clientIp = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || '';
  
  await logPointsConsumption(endpoint, apiCallStartTime, userAgent, clientIp);

  // ═════════════════════════════════════════════════
  // 💾 写入 Blob 缓存
  // ═════════════════════════════════════════════════
  try {
    const store = getStore('api-cache');
    await store.setJSON(cacheKey, { ts: Date.now(), body: bodyText });
    console.log(`[proxy] ✅ 已写入Blob缓存 | ${endpoint}`);
  } catch (writeErr) {
    console.error('[proxy] ️ 缓存写入失败（不影响返回）:', writeErr.message);
  }

  // ══════════════════════════════════════════════════
  // 🟢 返回成功响应（统一包装为 {ret: 0, body: ...} 格式）
  // ══════════════════════════════════════════════════
  let responseBody = bodyText;
  try {
    const apiData = JSON.parse(bodyText);
    if (apiData.ret !== undefined || apiData.code !== undefined) {
      responseBody = bodyText;
    } else {
      responseBody = JSON.stringify({ ret: 0, body: apiData });
    }
  } catch (e) {
    responseBody = JSON.stringify({ ret: 0, body: bodyText });
  }
  
  return {
    statusCode: 200,
    headers: {
      ...baseHeaders,
      ...buildCacheHeaders(),
      'X-Cache': 'MISS',
    },
    body: responseBody,
  };
};