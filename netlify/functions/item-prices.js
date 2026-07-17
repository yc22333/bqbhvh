/**
 * item-prices.js — 物品价格管理 API
 *
 * GET   /.netlify/functions/item-prices          → 获取全部物品及价格
 * POST  /.netlify/functions/item-prices          → 更新单个物品价格（需管理员）
 * POST  /.netlify/functions/item-prices?action=init → 从 bqb_data.js 初始化价格（需管理员）
 *
 * 管理员验证：admin_pass 与数据库中 admin_config 的 admin_password 比对
 */
const { createClient } = require('@supabase/supabase-js');

function _cleanEnv(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  while (s.length > 0 && (s[0] === '`' || s[0] === "'" || s[0] === '"' || s.charCodeAt(0) < 33)) s = s.slice(1);
  while (s.length > 0 && (s[s.length - 1] === '`' || s[s.length - 1] === "'" || s[s.length - 1] === '"' || s.charCodeAt(s.length - 1) < 33)) s = s.slice(0, -1);
  return s.trim();
}

const SUPABASE_URL = _cleanEnv(process.env.DATA_DB_URL);
const SUPABASE_KEY = _cleanEnv(process.env.DATA_DB_TOKEN);

let supabase;
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

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300, s-maxage=600',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  try {
    // ── GET: 获取全部物品及价格 ──
    if (event.httpMethod === 'GET') {
      // 获取所有物品
      const { data: items, error: itemsError } = await getSupabase()
        .from('game_items')
        .select('*')
        .order('id', { ascending: true });

      if (itemsError) {
        return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '查询物品失败: ' + itemsError.message }) };
      }

      // 获取所有自定义价格（表可能不存在，容错）
      let priceMap = {};
      try {
        const { data: prices } = await getSupabase()
          .from('item_prices')
          .select('*');
        if (prices) {
          prices.forEach(p => { priceMap[p.object_id] = p.price; });
        }
      } catch (e) {
        console.warn('[item-prices] item_prices 表不存在或查询失败，使用默认价格:', e.message);
      }

      // 合并数据
      const result = (items || []).map(item => ({
        ...item,
        custom_price: priceMap[item.object_id] || null,
        display_price: priceMap[item.object_id] || item.price || 0,
      }));

      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ ret: 0, data: result, total: result.length }),
      };
    }

    // ── POST: 更新价格 ──
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body); } catch {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'JSON格式错误' }) };
      }

      // 管理员验证
      const ADMIN_PASS = await getAdminPassword();
      if (!ADMIN_PASS || !body.admin_pass || String(body.admin_pass).trim() !== ADMIN_PASS) {
        return { statusCode: 403, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '管理员密码错误' }) };
      }

      const action = event.queryStringParameters?.action || 'update';

      // ── 初始化价格（从 bqb_data.js 导入） ──
      if (action === 'init') {
        const fs = require('fs');
        const path = require('path');
        const dataPath = path.join(__dirname, '..', '..', 'data', 'bqb_data.js');
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const match = fileContent.match(/var data = (\{[\s\S]*?\});/);
        if (!match) {
          return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无法解析 bqb_data.js' }) };
        }
        const data = JSON.parse(match[1]);
        const items = data.item_info_all || [];

        // 批量 upsert 到 item_prices 表
        const BATCH_SIZE = 500;
        let total = 0;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE).map(item => ({
            object_id: item.objectID || 0,
            price: item.price || 0,
            updated_at: new Date().toISOString(),
          })).filter(item => item.object_id > 0);

          if (batch.length > 0) {
            const { error } = await getSupabase()
              .from('item_prices')
              .upsert(batch, { onConflict: 'object_id', ignoreDuplicates: false });
            if (error) console.error('[item-prices] 批量导入错误:', error.message);
            else total += batch.length;
          }
        }

        return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ ret: 0, msg: `价格初始化完成: 共 ${total} 条` }) };
      }

      // ── 更新单个价格 ──
      const { object_id, price } = body;
      if (!object_id || price === undefined || price === null) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '缺少 object_id 或 price' }) };
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '价格无效' }) };
      }

      const { error: upsertError } = await getSupabase()
        .from('item_prices')
        .upsert({
          object_id: parseInt(object_id),
          price: priceNum,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'object_id', ignoreDuplicates: false });

      if (upsertError) {
        return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '更新失败: ' + upsertError.message }) };
      }

      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ ret: 0, msg: '价格更新成功' }) };
    }

    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '仅支持 GET/POST' }) };

  } catch (e) {
    console.error('[item-prices] 异常:', e.message);
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '服务器异常: ' + e.message }) };
  }
};