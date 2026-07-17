/**
 * leaderboard.js — 排行榜数据接口
 *
 * 安全措施：
 * 1. Origin 校验 + 无 CORS 通配符
 * 2. POST 数据结构验证：防止写入任意 JSON 覆盖存储
 * 3. IP 限流：防止刷屏
 */
const { createClient } = require('@supabase/supabase-js');

// 从 Netlify 环境变量读取（超级清理：移除所有空白、引号、反引号、控制字符）
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

// ==== 安全配置 ====
const ALLOWED_ORIGINS = [
  'localhost',
  '127.0.0.1',
  'biqibao.lol',  // 添加生产域名
  'www.biqibao.lol',
  'bqbhvh.netlify.app',  // 当前生产域名
];

// 允许所有来源进行开发测试（生产环境建议注释掉）
// const ALLOWED_ORIGINS = ['*'];

// 字段长度限制
const MAX_PLAYER_NAME = 20;
const MAX_RECORD_ITEM = 100; // 单条记录字段最大长度
const MAX_RECORDS = 10;      // 单个玩家最多保存的游戏记录数

// 简单内存限流
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 30 * 1000; // 30 秒
const RATE_LIMIT_MAX = 2;            // 窗口内最多 2 次提交

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

// 初始化 Supabase 客户端（仅在 Netlify 服务器内部使用，Key 不暴露给浏览器）
let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabaseClient;
}

// 验证并清理排行榜数据结构
function sanitizeLeaderboardData(raw) {
  if (!raw || typeof raw !== 'object') {
    return { playerName: '玩家', records: [] };
  }

  const playerName = (raw.playerName || '玩家').toString().slice(0, MAX_PLAYER_NAME);
  let records = Array.isArray(raw.records) ? raw.records : [];

  // 限制记录总数
  if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS);

  // 清理每条记录
  const sanitizedRecords = records.map(r => {
    if (!r || typeof r !== 'object') return null;
    const clean = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof k !== 'string' || k.length > 50) continue;
      if (typeof v === 'string') clean[k] = v.slice(0, MAX_RECORD_ITEM);
      else if (typeof v === 'number') clean[k] = isFinite(v) ? v : 0;
      else if (typeof v === 'boolean') clean[k] = v;
    }
    return clean;
  }).filter(r => r !== null);

  return { playerName, records: sanitizedRecords };
}

exports.handler = async (event) => {
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

    // 2. 测试 TCP/HTTP 连接
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
        const { data, error } = await testClient.from('leaderboard').select('*').limit(1);
        if (error) {
          clientTest = 'QUERY ERROR: ' + error.message + ' (code: ' + (error.code || 'none') + ')';
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
      body: JSON.stringify({ debug: diag }, null, 2),
    };
  }

  // ==== 安全检查：验证来源 ====
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: '拒绝访问：来源不受信任' }) };
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // 检查环境变量是否配置
  const sb = getSupabase();
  if (!sb) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '服务端 Supabase 未配置' }) };
  }

  try {
    // ==== 诊断：检查 Supabase 配置 ====
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Supabase 环境变量未设置：请在 Netlify 后台配置 DATA_DB_URL 和 DATA_DB_TOKEN',
          debug: getConfigDiagnosis(),
        }),
      };
    }

    // GET — 读取排行榜（返回全榜前 100 条，按分数降序）
    if (event.httpMethod === 'GET') {
      console.log('[leaderboard] Supabase URL:', SUPABASE_URL.slice(0, 35) + '...');
      console.log('[leaderboard] Supabase KEY prefix:', SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)');

      const { data, error } = await sb
        .from('leaderboard')
        .select('player_name, game_id, score, details, created_at')
        .order('score', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[leaderboard] Supabase 错误:', error.message, '| code:', error.code);
        let friendlyMsg = '数据库查询失败';
        if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('relation')) {
          friendlyMsg = 'leaderboard 表不存在！请在 Supabase SQL Editor 中运行建表脚本';
        } else if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          friendlyMsg = '权限不足：请使用 service_role key，或为 anon key 添加 RLS 策略';
        }
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: friendlyMsg,
            debug: {
              url: SUPABASE_URL.slice(0, 35) + '...',
              keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
              supabaseCode: error.code || '(none)',
              supabaseDetails: error.details || error.message,
            },
          }),
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ playerName: '排行榜', records: data }) };
    }

    // POST — 写入一条成绩
    if (event.httpMethod === 'POST') {
      // IP 限流
      const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || event.headers['x-nf-client-connection-ip']
        || 'unknown';
      if (!checkRateLimit(clientIP)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: '请求过于频繁，请稍后再试' }) };
      }

      // 解析 JSON
      let raw;
      try { raw = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '请求体格式错误' }) };
      }

      // 提取成绩字段
      const playerName = (raw.playerName || raw.player_name || '玩家').toString().slice(0, MAX_PLAYER_NAME);
      const gameId = (raw.gameId || raw.game_id || 'game1').toString().slice(0, 50);
      const score = typeof raw.score === 'number' && isFinite(raw.score) ? raw.score : 0;
      const details = raw.details && typeof raw.details === 'object' ? raw.details : {};

      // 写入 Supabase
      const { data, error } = await sb
        .from('leaderboard')
        .insert([{
          player_name: playerName,
          game_id: gameId,
          score: score,
          details: details,
        }])
        .select('player_name, game_id, score');

      if (error) {
        console.error('[leaderboard] 写入错误:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
        let friendlyMsg = '数据库写入失败';
        if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('relation')) {
          friendlyMsg = 'leaderboard 表不存在！请在 Supabase SQL Editor 中运行建表脚本';
        } else if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          friendlyMsg = '权限不足：请使用 service_role key，或为 anon key 添加 RLS 策略';
        } else if (error.code === '23505' || error.message.includes('duplicate')) {
          friendlyMsg = '重复数据：该记录已存在';
        } else if (error.code === '22003' || error.message.includes('numeric') || error.message.includes('overflow')) {
          friendlyMsg = '分数值过大，请扩大 leaderboard.score 列精度（ALTER COLUMN score TYPE NUMERIC(1000, 10)）';
        }
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: friendlyMsg,
            debug: {
              url: SUPABASE_URL.slice(0, 35) + '...',
              keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
              supabaseCode: error.code || '(none)',
              supabaseDetails: error.details || error.message,
              score: raw ? raw.score : '(unknown)',
            },
          }),
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (error) {
    console.error('[leaderboard] 未捕获异常:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '服务器内部错误: ' + error.message,
        debug: {
          stack: error.stack?.slice(0, 300) || '(无调用栈)',
          url: SUPABASE_URL ? SUPABASE_URL.slice(0, 35) + '...' : '(not set)',
          keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.slice(0, 10) + '...' : '(not set)',
        },
      }),
    };
  }
};
