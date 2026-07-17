/**
 * scheduled-daily.js — 每日0点5分自动刷新缓存（北京时区 UTC+8）
 * 
 * 定时任务：
 *   🔐 今日密码（map_pwd） — 1 Token
 *   🏭 今日制造（manufacture，4个工作台） — 4 Token
 * 
 * 数据写入 Supabase api_cache 表，供前端 api-reader 读取
 * 
 * Netlify Scheduled Function:
 *   schedule: "5 16 * * *"  ← 16:05 UTC = 00:05 北京 (UTC+8)
 */
const { saveApiCacheToSupabase, logPointsConsumption, fetchUpstreamApi, BASE_URL } = require('./_shared');

exports.schedule = "5 16 * * *";

exports.handler = async function (event) {
  console.log('[scheduled-daily] 🔄 开始每日定时刷新（00:05 北京）...');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Content-Type': 'application/json' }, body: '' };
  }

  let dailyTokenCost = 0;
  const errors = [];

  // ═══════════════════════════════════════════════
  // 1. 刷新今日密码 (map_pwd) — 1 Token
  // ═══════════════════════════════════════════════
  try {
    console.log('[scheduled-daily] 🔐 刷新今日密码...');
    const mapPwdResult = await fetchUpstreamApi('/v1/sjz_api/map_pwd');

    if (mapPwdResult.success) {
      const cacheData = mapPwdResult.data.data !== undefined ? mapPwdResult.data.data : mapPwdResult.data;
      await saveApiCacheToSupabase('map_pwd', cacheData);
      await logPointsConsumption('/v1/sjz_api/map_pwd', Date.now(), 1);
      dailyTokenCost += 1;
      console.log(`[scheduled-daily] ✅ 今日密码刷新成功 (${mapPwdResult.duration}ms)`);
    } else {
      errors.push(`map_pwd: ${mapPwdResult.error}`);
    }
  } catch (e) {
    console.error('[scheduled-daily] ❌ 今日密码异常:', e.message);
    errors.push(`map_pwd: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 2. 刷新今日制造 (manufacture, 4个工作台) — 4 Token
  // ═══════════════════════════════════════════════
  try {
    console.log('[scheduled-daily] 🏭 刷新今日制造（4个工作台）...');
    const workshops = [1, 2, 3, 4]; // 1技术中心 2工作台 3制药台 4防具台
    const level = 3;
    const combinedData = {};
    let workshopSuccess = true;

    for (const t of workshops) {
      const result = await fetchUpstreamApi('/v1/sjz_api/manufacturePro', { t, l: level });

      if (result.success) {
        let data = [];
        const parsed = result.data;
        if (parsed.data && Array.isArray(parsed.data)) {
          data = parsed.data;
        } else if (Array.isArray(parsed)) {
          data = parsed;
        }
        combinedData[t] = data;
      } else {
        combinedData[t] = [];
        workshopSuccess = false;
        errors.push(`manufacture t=${t}: ${result.error}`);
      }
    }

    // 保存组合数据到 Supabase
    await saveApiCacheToSupabase('manufacture', combinedData);

    // 记录积分消耗（4个工作台 × 1 Token）
    await logPointsConsumption('/v1/sjz_api/manufacturePro', Date.now(), 4);
    dailyTokenCost += 4;

    if (workshopSuccess) {
      console.log('[scheduled-daily] ✅ 今日制造刷新成功（4个工作台）');
    } else {
      console.warn('[scheduled-daily] ⚠️ 今日制造部分工作台刷新失败');
    }
  } catch (e) {
    console.error('[scheduled-daily] ❌ 今日制造异常:', e.message);
    errors.push(`manufacture: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 3. 完成
  // ═══════════════════════════════════════════════
  const status = errors.length === 0 ? '全部成功' : `部分失败 (${errors.length}个错误)`;
  console.log(`[scheduled-daily] ✅ 每日定时刷新完成 | 消耗 ${dailyTokenCost} Token | ${status}`);

  if (errors.length > 0) {
    console.error('[scheduled-daily] ❌ 错误详情:', errors.join('; '));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ret: 0,
      msg: status,
      token_cost: dailyTokenCost,
      errors: errors.length > 0 ? errors : undefined,
    }),
  };
};