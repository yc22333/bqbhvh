/**
 * Netlify Function — 系统日志接口
 * 
 * 功能：
 *   从Supabase读写系统日志，替代localStorage存储
 *
 * 使用方式：
 *   GET  /.netlify/functions/logs              — 获取日志列表
 *   POST /.netlify/functions/logs              — 添加日志
 *   DELETE /.netlify/functions/logs?admin_key=xxx  — 清空日志
 */
const { createClient } = require('@supabase/supabase-js');

function _cleanEnv(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  while (s.length > 0 && (s[0] === '`' || s[0] === "'" || s[0] === '"' || s.charCodeAt(0) < 33)) s = s.slice(1);
  while (s.length > 0 && (s[s.length-1] === '`' || s[s.length-1] === "'" || s[s.length-1] === '"' || s.charCodeAt(s.length-1) < 33)) s = s.slice(0, -1);
  return s.trim();
}

const SUPABASE_URL = _cleanEnv(process.env.DATA_DB_URL);
const SUPABASE_KEY = _cleanEnv(process.env.DATA_DB_TOKEN);

let supabase = null;
function getSupabase() {
  if (!supabase) supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  return supabase;
}

async function getAdminPassword() {
  const envPass = _cleanEnv(process.env.DONATIONS_ADMIN_PASS);
  if (envPass) return envPass;
  try {
    const { data } = await getSupabase().from('admin_config').select('config_value').eq('config_key', 'admin_password').single();
    return data?.config_value || null;
  } catch { return null; }
}

const MAX_LOGS = 500;

exports.handler = async function (event) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  try {
    // GET - 读取日志
    if (event.httpMethod === 'GET') {
      const { data, error } = await getSupabase()
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_LOGS);

      if (error) throw error;

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ ret: 0, data: data || [] }),
      };
    }

    // POST - 添加日志
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'JSON格式错误' }) };
      }

      const { tag, text, time } = body;
      if (!text) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '缺少日志内容' }) };
      }

      const insertData = {
        tag: (tag || 'info').toString().slice(0, 20),
        text: text.toString().slice(0, 500),
        time: (time || new Date().toLocaleTimeString('zh-CN', { hour12: false })).toString().slice(0, 20),
      };

      const { data, error } = await getSupabase()
        .from('system_logs')
        .insert(insertData)
        .select('id, tag, text, time, created_at');

      if (error) throw error;

      // 自动清理超出限制的旧日志
      await getSupabase()
        .rpc('cleanup_old_logs', { max_rows: MAX_LOGS })
        .catch(() => {});

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ ret: 0, data: data?.[0] }),
      };
    }

    // DELETE - 清空日志（需要管理员密码）
    if (event.httpMethod === 'DELETE') {
      const adminKey = event.queryStringParameters?.admin_key || '';
      const ADMIN_PASS = await getAdminPassword();
      if (!ADMIN_PASS || adminKey !== ADMIN_PASS) {
        return { statusCode: 403, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无权限' }) };
      }

      const { error } = await getSupabase().from('system_logs').delete().gte('id', 0);
      if (error) throw error;

      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ ret: 0, msg: '已清空' }) };
    }

    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'Method Not Allowed' }) };
  } catch (err) {
    console.error('[logs] 异常:', err.message);
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: err.message }) };
  }
};
