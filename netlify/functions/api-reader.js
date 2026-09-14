/**
 * Netlify Function — API数据读取器（公开访问）
 * 
 * 功能：
 *   从Supabase读取API缓存数据，供所有用户使用
 *
 * 使用方式：
 *   GET /.netlify/functions/api-reader?endpoint=manufacture
 *   GET /.netlify/functions/api-reader?endpoint=map_pwd
 *   GET /.netlify/functions/api-reader?endpoint=card_zhanbei
 */
const { createClient } = require('@supabase/supabase-js');

// 环境变量
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

// endpoint 到 cacheId 的映射
const ENDPOINT_MAP = {
  'manufacture': 'manufacture',
  'map_pwd': 'map_pwd',
  'card_zhanbei': 'card_zhanbei',
  // 兼容旧名称
  'battle_zb': 'card_zhanbei',
  'jzv3_zb': 'card_zhanbei',
};

exports.handler = async function (event) {
  // 基础响应头
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // OPTIONS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  // 只允许 GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '仅支持 GET 请求' }),
    };
  }

  // 解析 endpoint 参数
  const endpoint = event.queryStringParameters?.endpoint || '';
  const cacheId = ENDPOINT_MAP[endpoint];

  if (!cacheId) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ 
        ret: -1, 
        msg: '无效的 endpoint 参数，可用值: manufacture, map_pwd, card_zhanbei' 
      }),
    };
  }

  try {
    // 从Supabase读取数据
    const { data, error } = await getSupabase()
      .from('api_cache')
      .select('data, updated_at')
      .eq('id', cacheId)
      .single();

    if (error || !data) {
      console.log(`[api-reader] ⚠️ 未找到缓存: ${cacheId}`);
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({
          ret: 404,
          msg: '暂无缓存数据，请联系管理员刷新',
          endpoint: endpoint,
          cache_id: cacheId,
        }),
      };
    }

    console.log(`[api-reader] ✅ 读取成功: ${cacheId}`);

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: '读取成功',
        endpoint: endpoint,
        cache_id: cacheId,
        updated_at: data.updated_at,
        data: data.data,
      }),
    };

  } catch (e) {
    console.error(`[api-reader] ❌ 异常:`, e.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '服务器异常: ' + e.message }),
    };
  }
};