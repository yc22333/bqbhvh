/**
 * scheduled-card.js — 每2小时自动刷新卡战备缓存（北京时区 UTC+8）
 * 
 * 定时任务（一天12次）：
 *   ⚔️ 卡战备（card_zhanbei，5个档位: LV 0,1,2,3,5） — 每次 10 Token
 * 
 * 数据写入 Supabase api_cache 表，供前端 api-reader 读取
 * 
 * Netlify Scheduled Function:
 *   schedule: "5 */2 * * *"
 *   ─ UTC 偶数时: 00:05, 02:05, 04:05, 06:05, 08:05, 10:05,
 *                 12:05, 14:05, 16:05, 18:05, 20:05, 22:05
 *   ─ 北京 UTC+8: 08:05, 10:05, 12:05, 14:05, 16:05, 18:05,
 *                 20:05, 22:05, 00:05, 02:05, 04:05, 06:05
 */
const { saveApiCacheToSupabase, logPointsConsumption, fetchUpstreamApi, BASE_URL } = require('./_shared');

exports.schedule = "5 */2 * * *";

// 卡战备档位定义
const ZB_LV_LEVELS = [0, 1, 2, 3, 5];
const ZB_LV_LABELS = {0: '11W', 1: '18W', 2: '55W', 3: '60W', 5: '78W'};

exports.handler = async function (event) {
  console.log('[scheduled-card] 🔄 开始每日卡战备定时刷新（00:05 北京）...');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Content-Type': 'application/json' }, body: '' };
  }

  let totalTokenCost = 0;
  const errors = [];
  const results = {};
  ZB_LV_LEVELS.forEach(function(lv) { results[lv] = { data: [] }; });

  // ═══════════════════════════════════════════════
  // 逐档位刷新卡战备（5个档位 × 2 Token = 10 Token）
  // ═══════════════════════════════════════════════
  for (const lv of ZB_LV_LEVELS) {
    const lvStartTime = Date.now();
    console.log(`[scheduled-card] ⚔️ 刷新卡战备 LV=${lv} (${ZB_LV_LABELS[lv]})...`);

    try {
      const apiResult = await fetchUpstreamApi('/v1/sjz_api/jzv3_zb', { lv: lv });

      if (!apiResult.success) {
        errors.push(`jzv3_zb LV=${lv}: ${apiResult.error}`);
        console.error(`[scheduled-card] ❌ jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 失败: ${apiResult.error}`);
        continue;
      }

      const parsed = apiResult.data;
      let groups = [];

      // 从响应中提取配装组数组
      if (parsed.data !== undefined) {
        if (!Array.isArray(parsed.data) && typeof parsed.data === 'object') {
          // 尝试从 data 的子字段找数组
          for (var k in parsed.data) {
            if (Array.isArray(parsed.data[k])) {
              groups = parsed.data[k];
              break;
            }
          }
        } else if (Array.isArray(parsed.data)) {
          groups = parsed.data;
        }
      } else if (Array.isArray(parsed.body)) {
        groups = parsed.body;
      } else if (Array.isArray(parsed)) {
        groups = parsed;
      }

      console.log(`[scheduled-card] jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 原始组数: ${groups.length}`);

      if (groups.length === 0) {
        console.warn(`[scheduled-card] ⚠️ jzv3_zb LV=${lv} 未能提取到配装组`);
        continue;
      }

      // 1. 过滤：排除名称含"兑换"的组
      const filtered = groups.filter(function(g) {
        const name = g.name || g.title || g.label || '';
        return name.indexOf('兑换') === -1;
      });

      // 2. 计算总花费并按升序排序
      filtered.forEach(function(g) {
        const items = g.data || g.items || g.equipment || g.equip || g.list || [];
        let totalCost = 0;
        items.forEach(function(item) {
          totalCost += item.price || item.value || item.totalPrice || 0;
        });
        g._totalCost = g.price || g.totalPrice || g.total_price || g.cost || totalCost;
      });
      filtered.sort(function(a, b) {
        return (a._totalCost || 0) - (b._totalCost || 0);
      });

      // 3. 取前10条最便宜方案
      const top10 = filtered.slice(0, 10);
      console.log(`[scheduled-card] jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 过滤后: ${filtered.length}组, 取前10: ${top10.length}组`);

      // 4. 包装成前端兼容格式
      results[lv] = {
        data: top10.map(function(g) {
          return {
            name: g.name || g.title || '配装方案',
            jz: g.jz || g._totalCost || 0,
            cz: g.cz || g.fakeProfit || 0,
            data: g.data || g.items || g.equipment || g.equip || [],
          };
        }),
      };

      // 记录积分消耗（每档位 × 2 Token）
      await logPointsConsumption('/v1/sjz_api/jzv3_zb', lvStartTime, 2);
      totalTokenCost += 2;
      console.log(`[scheduled-card] 💰 jzv3_zb LV=${lv} 已消耗2 Token`);

    } catch (e) {
      console.error(`[scheduled-card] ❌ jzv3_zb LV=${lv} 异常:`, e.message);
      errors.push(`jzv3_zb LV=${lv}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════
  // 写入 Supabase 缓存
  // ═══════════════════════════════════════════════
  try {
    await saveApiCacheToSupabase('card_zhanbei', results);
    console.log(`[scheduled-card] ✅ card_zhanbei 已写入Supabase（${ZB_LV_LEVELS.length}个档位: ${ZB_LV_LEVELS.join(', ')}）`);
  } catch (e) {
    console.error('[scheduled-card] ❌ card_zhanbei 写入Supabase失败:', e.message);
    errors.push('写入Supabase失败: ' + e.message);
  }

  // ═══════════════════════════════════════════════
  // 完成
  // ═══════════════════════════════════════════════
  const status = errors.length === 0 ? '全部成功' : `部分失败 (${errors.length}个错误)`;
  console.log(`[scheduled-card] ✅ 卡战备定时刷新完成 | 消耗 ${totalTokenCost} Token | ${status}`);

  if (errors.length > 0) {
    console.error('[scheduled-card] ❌ 错误详情:', errors.join('; '));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ret: 0,
      msg: status,
      token_cost: totalTokenCost,
      errors: errors.length > 0 ? errors : undefined,
    }),
  };
};