/**
 * Netlify Function — 游戏存档接口
 * 
 * 功能：
 *   从Supabase读写游戏存档，替代localStorage存储
 *   支持多设备同步
 *
 * 使用方式：
 *   GET  /.netlify/functions/game-saves?player_id=xxx  — 获取存档
 *   POST /.netlify/functions/game-saves                — 保存/覆盖存档
 *   DELETE /.netlify/functions/game-saves?player_id=xxx&admin_key=xxx — 删除存档
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

exports.handler = async function (event) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const playerId = params.player_id || 'default';

    // GET - 读取存档
    if (event.httpMethod === 'GET') {
      const { data, error } = await getSupabase()
        .from('game_saves')
        .select('*')
        .eq('player_id', playerId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = 无数据
        console.error('[game-saves] 查询失败:', error.message);
      }

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({
          ret: 0,
          data: data || null,
        }),
      };
    }

    // POST - 保存/覆盖存档
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'JSON格式错误' }) };
      }

      const { game_id, save_data } = body;
      if (!game_id || !save_data) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '缺少 game_id 或 save_data' }) };
      }

      // 使用 upsert：如果 player_id + game_id 已存在则更新，否则插入
      const { data, error } = await getSupabase()
        .from('game_saves')
        .upsert({
          player_id: playerId,
          game_id: game_id.toString().slice(0, 50),
          save_data: save_data,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id, game_id',
        })
        .select();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ ret: 0, data: data?.[0] }),
      };
    }

    // DELETE - 删除存档（需要管理员密码或验证）
    if (event.httpMethod === 'DELETE') {
      const adminKey = params.admin_key || '';
      const ADMIN_PASS = await getAdminPassword();
      if (!ADMIN_PASS || adminKey !== ADMIN_PASS) {
        return { statusCode: 403, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无权限' }) };
      }

      const { error } = await getSupabase()
        .from('game_saves')
        .delete()
        .eq('player_id', playerId);

      if (error) throw error;

      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ ret: 0, msg: '存档已删除' }) };
    }

    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'Method Not Allowed' }) };
  } catch (err) {
    console.error('[game-saves] 异常:', err.message);
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: err.message }) };
  }
};
