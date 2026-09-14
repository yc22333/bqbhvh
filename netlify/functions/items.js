/**
 * Netlify Function — 物品数据接口
 * 
 * 功能：
 *   从Supabase读取物品数据(game_items表)，供前端使用
 *   替代原有的 data/bqb_data.js 静态文件
 *
 * 使用方式：
 *   GET /.netlify/functions/items                    — 获取全部物品
 *   GET /.netlify/functions/items?type=ammo          — 按类型筛选
 *   GET /.netlify/functions/items?search=钥匙        — 按名称搜索
 *   GET /.netlify/functions/items?id=123             — 按ID获取单个
 *   GET /.netlify/functions/items?page=1&limit=500   — 分页
 */
const { createClient } = require('@supabase/supabase-js');

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

exports.handler = async function (event) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '仅支持 GET 请求' }),
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const { id, type, search, page, limit } = params;

    if (id) {
      const { data, error } = await getSupabase()
        .from('game_items')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers: baseHeaders,
          body: JSON.stringify({ ret: -1, msg: '物品不存在' }),
        };
      }

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ ret: 0, data: data }),
      };
    }

    let query = getSupabase().from('game_items').select('*', { count: 'estimated' });

    if (type) {
      query = query.eq('primaryClass', type);
    }

    if (search) {
      query = query.ilike('objectName', '%' + search + '%');
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 1000, 5000);
    const offset = (pageNum - 1) * limitNum;

    query = query.range(offset, offset + limitNum - 1).order('id', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error('[items] 查询失败:', error.message);
      return {
        statusCode: 500,
        headers: baseHeaders,
        body: JSON.stringify({ ret: -1, msg: '查询失败: ' + error.message }),
      };
    }

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        data: data,
        total: count,
        page: pageNum,
        limit: limitNum,
      }),
    };

  } catch (e) {
    console.error('[items] 异常:', e.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '服务器异常: ' + e.message }),
    };
  }
};
