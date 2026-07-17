/**
 * _shared.js — 定时刷新任务的共享工具模块
 * 
 * 被 scheduled-daily.js 和 scheduled-card.js 共用
 * 不对外暴露为独立 Function（下划线前缀）
 */
const { createClient } = require('@supabase/supabase-js');

// ── 环境变量 ──
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

const DATA_SOURCE_TOKEN = process.env.DATA_SOURCE_TOKEN;
const BASE_URL = process.env.DATA_API_BASE || 'https://orzice.com/workApi';
const SUPABASE_URL = _cleanEnv(process.env.DATA_DB_URL);
const SUPABASE_KEY = _cleanEnv(process.env.DATA_DB_TOKEN);

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase 环境变量未配置（DATA_DB_URL / DATA_DB_TOKEN）');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return supabase;
}

/**
 * 写入 API 缓存到 Supabase api_cache 表
 * @param {string} cacheId  - 缓存键（如 'map_pwd', 'manufacture', 'card_zhanbei'）
 * @param {any}    data     - 缓存数据
 */
async function saveApiCacheToSupabase(cacheId, data) {
  const { error } = await getSupabase()
    .from('api_cache')
    .upsert({
      id: cacheId,
      data: data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error(`[_shared] ❌ 写入Supabase api_cache(${cacheId}) 失败:`, error.message);
    return false;
  }
  console.log(`[_shared] ✅ 写入Supabase api_cache: ${cacheId}`);
  return true;
}

/**
 * 记录积分消耗日志到 Supabase（与 cache-manager.js 完全一致的格式）
 * @param {string} endpoint   - API 路径
 * @param {number} timestamp  - 时间戳
 * @param {number} pointsCost - 消耗 Token 数
 */
async function logPointsConsumption(endpoint, timestamp, pointsCost) {
  try {
    const logEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      endpoint: endpoint,
      timestamp: timestamp,
      time_str: new Date(timestamp).toISOString(),
      user_agent: 'scheduled-task',
      ip: 'internal',
      type: 'scheduled_refresh',
      cost: pointsCost,
    };

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

    logs.unshift(logEntry);
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }

    const { error: upsertError } = await getSupabase()
      .from('api_cache')
      .upsert({
        id: 'points_log',
        data: {
          initial_points: initialPoints,
          last_updated: Date.now(),
          total_calls: totalCalls + 1,
          total_points_consumed: totalPointsConsumed + pointsCost,
          logs: logs,
        },
      });

    if (upsertError) {
      console.error('[_shared] ❌ 积分日志写入失败:', upsertError.message);
    } else {
      console.log(`[_shared] 💰 积分消耗已记录 | ${endpoint} | -${pointsCost} Token`);
    }
  } catch (e) {
    console.error('[_shared] ❌ 积分日志写入异常:', e.message);
  }
}

/**
 * 请求上游 API
 * @param {string} apiPath  - API 路径（如 '/v1/sjz_api/map_pwd'）
 * @param {object} extraParams - 额外查询参数
 * @returns {{ success: boolean, data: any, duration: number, status: number }}
 */
async function fetchUpstreamApi(apiPath, extraParams = {}) {
  if (!DATA_SOURCE_TOKEN) {
    console.error('[_shared] ❌ DATA_SOURCE_TOKEN 未配置');
    return { success: false, data: null, duration: 0, status: 0, error: 'TOKEN_NOT_CONFIGURED' };
  }

  const params = new URLSearchParams();
  params.set('token', DATA_SOURCE_TOKEN);
  for (const [k, v] of Object.entries(extraParams)) {
    params.set(k, v);
  }

  const targetUrl = `${BASE_URL}${apiPath}?${params}`;
  const startTime = Date.now();

  try {
    const resp = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const duration = Date.now() - startTime;
    const bodyText = await resp.text();

    if (!resp.ok) {
      console.error(`[_shared] ❌ ${apiPath} 失败: HTTP ${resp.status}`);
      return { success: false, data: null, duration, status: resp.status, error: `HTTP ${resp.status}` };
    }

    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      console.error(`[_shared] ❌ ${apiPath} JSON解析失败`);
      return { success: false, data: null, duration, status: resp.status, error: 'JSON_PARSE_ERROR' };
    }

    return { success: true, data: parsed, duration, status: resp.status };
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[_shared] ❌ ${apiPath} 网络异常:`, e.message);
    return { success: false, data: null, duration, status: 0, error: e.message };
  }
}

module.exports = {
  getSupabase,
  saveApiCacheToSupabase,
  logPointsConsumption,
  fetchUpstreamApi,
  DATA_SOURCE_TOKEN,
  BASE_URL,
};