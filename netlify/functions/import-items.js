/**
 * Netlify Function — 数据导入工具
 * 
 * 功能：
 *   将 bqb_data.js 中的 item_info_all 批量导入到 Supabase game_items 表
 *   使用方式（管理员）：
 *   POST /.netlify/functions/import-items
 *   Body: { "admin_key": "xxx", "items": [...] }
 *   
 *   或者从 bqb_data.js 文件读取：
 *   POST /.netlify/functions/import-items?source=file
 *   Body: { "admin_key": "xxx" }
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '仅支持 POST' }) };
  }

  try {
    let body;
    try { body = JSON.parse(event.body); } catch {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: 'JSON格式错误' }) };
    }

    // 管理员验证
    const adminKey = body.admin_key || '';
    const ADMIN_PASS = await getAdminPassword();
    if (!ADMIN_PASS || adminKey !== ADMIN_PASS) {
      return { statusCode: 403, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无权限' }) };
    }

    let items = body.items;

    // 从文件读取
    if (!items || !Array.isArray(items)) {
      try {
        const dataPath = path.join(__dirname, '..', '..', 'data', 'bqb_data.js');
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        // 提取 JSON 部分
        const match = fileContent.match(/var data = (\{[\s\S]*?\});/);
        if (match) {
          const data = JSON.parse(match[1]);
          items = data.item_info_all;
        }
      } catch (e) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无法读取本地文件: ' + e.message }) };
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: '无有效物品数据' }) };
    }

    // 分批导入（每批500条）
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const records = batch.map(item => ({
        object_id: item.objectID || 0,
        object_name: item.objectName || '',
        primary_class: item.primaryClass || '',
        second_class: item.secondClass || '',
        second_class_cn: item.secondClassCN || '',
        grade: item.grade || 0,
        oid: item.oid || 0,
        is_get: item.is_get || 0,
        length: item.length || 1,
        width: item.width || 1,
        pic: item.pic || '',
        desc: item.desc || '',
        detail: item.detail || '',
      }));

      const { data, error } = await getSupabase()
        .from('game_items')
        .upsert(records, {
          onConflict: 'object_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[import-items] 批处理 ${i / BATCH_SIZE + 1} 失败:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
      }
    }

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: `导入完成: 成功 ${totalInserted} 条, 失败 ${totalErrors} 条`,
        total: items.length,
        inserted: totalInserted,
        errors: totalErrors,
      }),
    };

  } catch (err) {
    console.error('[import-items] 异常:', err.message);
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ ret: -1, msg: err.message }) };
  }
};
