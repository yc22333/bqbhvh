/**
 * Netlify Function — 缓存管理器（管理员专用）
 * 
 * 功能：
 *   1. 手动刷新所有缓存（预热）
 *   2. 查看积分消耗日志
 *   3. 清空缓存
 *   4. 查看缓存状态
 *
 * 🔒 安全策略：仅管理员密码可访问（从数据库获取）
 *
 * 使用方式：
 *   GET /.netlify/functions/cache-manager?admin_key=YOUR_PASSWORD&action=refresh
 *   GET /.netlify/functions/cache-manager?admin_key=YOUR_PASSWORD&action=log_stats
 *   GET /.netlify/functions/cache-manager?admin_key=YOUR_PASSWORD&action=clear
 *   GET /.netlify/functions/cache-manager?admin_key=YOUR_PASSWORD&action=status
 */
const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');

const DATA_SOURCE_TOKEN = process.env.DATA_SOURCE_TOKEN;
const BASE_URL = process.env.DATA_API_BASE || 'https://orzice.com/workApi';
const POINTS_LOG_STORE = process.env.POINTS_LOG_STORE || 'points-log';

// Supabase 客户端
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

// 从数据库获取管理员密码（支持环境变量作为 fallback）
async function getAdminPassword() {
  // 优先从环境变量读取（用于本地开发）
  const envPass = _cleanEnv(process.env.DONATIONS_ADMIN_PASS);
  if (envPass) {
    return envPass;
  }
  
  // 从数据库读取
  try {
    const { data, error } = await getSupabase()
      .from('admin_config')
      .select('config_value')
      .eq('config_key', 'admin_password')
      .single();
    
    if (error || !data) {
      console.warn('[cache-manager] 数据库中未找到管理员密码配置');
      return null;
    }
    
    return data.config_value;
  } catch (err) {
    console.error('[cache-manager] 读取管理员密码失败:', err);
    return null;
  }
}

// 需要预热的接口列表
const WARM_ENDPOINTS = [
  // 卡战备（每档位单独请求，lv=0~5，每档位消耗2 Token）
  '/v1/sjz_api/jzv3_zb',
  
  // 今日制造Pro（4个工作台，每个消耗1 Token）
  '/v1/sjz_api/manufacturePro',
  
  // 每日密码（消耗1 Token）
  '/v1/sjz_api/map_pwd',
];

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

  // 检查管理员密码
  const adminKey = event.queryStringParameters?.admin_key || '';
  const ADMIN_PASS = await getAdminPassword();
  if (!ADMIN_PASS || adminKey !== ADMIN_PASS) {
    return {
      statusCode: 403,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '拒绝访问：管理员密码无效或未配置' }),
    };
  }

  // 解析操作类型
  const action = event.queryStringParameters?.action || 'status';

  try {
    switch (action) {
      case 'refresh':
        return await handleRefresh(baseHeaders);
      
      case 'refresh_single':
        return await handleRefreshSingle(baseHeaders, event.queryStringParameters?.endpoint);
      
      case 'log_stats':
        return await handleLogStats(baseHeaders);
      
      case 'clear':
        return await handleClear(baseHeaders);
      
      case 'clear_single':
        return await handleClearSingle(baseHeaders, event.queryStringParameters?.cache_id);
      
      case 'sync_remaining':
        return await handleSyncRemaining(baseHeaders, event.queryStringParameters?.remaining);
      
      case 'status':
        return await handleStatus(baseHeaders);
      
      default:
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: JSON.stringify({ ret: -1, msg: '无效的 action 参数' }),
        };
    }
  } catch (e) {
    console.error('[cache-manager] ❌ 异常:', e.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '服务器异常: ' + e.message }),
    };
  }
};

// ══════════════════════════════════════════════════
// ☁️ Supabase API缓存操作
// ══════════════════════════════════════════════════

// endpoint路径到cacheId的映射
const ENDPOINT_TO_CACHE_ID = {
  '/v1/sjz_api/map_pwd': 'map_pwd',
  '/v1/sjz_api/manufacturePro': 'manufacture',
  '/v1/sjz_api/jzv3_zb': 'card_zhanbei',
};

function endpointToCacheId(endpoint) {
  return ENDPOINT_TO_CACHE_ID[endpoint] || null;
}

// 写入API缓存到Supabase
async function saveApiCacheToSupabase(cacheId, data) {
  try {
    const { error } = await getSupabase()
      .from('api_cache')
      .upsert({
        id: cacheId,
        data: data,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });
    
    if (error) {
      console.error(`[cache-manager] ❌ 写入Supabase api_cache 失败:`, error.message);
      return false;
    }
    
    console.log(`[cache-manager] ✅ 写入Supabase api_cache: ${cacheId}`);
    return true;
  } catch (e) {
    console.error(`[cache-manager] ❌ 写入Supabase异常:`, e.message);
    return false;
  }
}

// 从Supabase读取API缓存
async function getApiCacheFromSupabase(cacheId) {
  try {
    const { data, error } = await getSupabase()
      .from('api_cache')
      .select('data, updated_at')
      .eq('id', cacheId)
      .single();
    
    if (error || !data) {
      console.log(`[cache-manager] ⚠️ Supabase中未找到缓存: ${cacheId}`);
      return null;
    }
    
    console.log(`[cache-manager] ✅ 从Supabase读取缓存: ${cacheId}`);
    return data;
  } catch (e) {
    console.error(`[cache-manager] ❌ 从Supabase读取异常:`, e.message);
    return null;
  }
}

// ══════════════════════════════════════════════════
// 🔥 刷新单个缓存（同时写入Supabase）
// ══════════════════════════════════════════════════
async function handleRefreshSingle(baseHeaders, endpointType) {
  console.log('[cache-manager] 🔄 开始刷新单个缓存:', endpointType);
  
  if (!DATA_SOURCE_TOKEN) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: 'DATA_SOURCE_TOKEN 未配置' }),
    };
  }
  
  // 映射 endpoint 类型到实际 API 路径
  const endpointMap = {
    'map_pwd': '/v1/sjz_api/map_pwd',
    'manufacture': '/v1/sjz_api/manufacturePro',
    'card_zhanbei': '/v1/sjz_api/jzv3_zb',
  };
  
  // 卡战备V4：1次API调用获取全部5个档位(LV 0,1,2,3,5)，使用专用处理函数
  // V4比V3更优惠：仅需5积分/次（V3需10积分/档位），且需过滤"兑换"组+排序取前10
  if (endpointType === 'card_zhanbei') {
    return await handleRefreshCardZhanbei(baseHeaders);
  }

  // 今日制造需要分别调用4个工作台
  if (endpointType === 'manufacture') {
    return await handleRefreshManufacture(baseHeaders);
  }
  
  const endpoint = endpointMap[endpointType];
  if (!endpoint) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '无效的 endpoint 参数' }),
    };
  }
  
  try {
    // 构造API请求URL
    const params = new URLSearchParams();
    params.set('token', DATA_SOURCE_TOKEN);
    const apiPath = endpoint.split('?')[0];
    const targetUrl = `${BASE_URL}${apiPath}?${params}`;
    
    // 发起请求
    const startTime = Date.now();
    const resp = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const duration = Date.now() - startTime;
    
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`[cache-manager] ❌ ${endpoint} 失败: HTTP ${resp.status}`);
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({
          ret: -1,
          msg: `HTTP ${resp.status}: ${errText.slice(0, 100)}`,
        }),
      };
    }
    
    // 读取响应
    const bodyText = await resp.text();
    
    // 写入Supabase缓存（替代Blob缓存，实现多设备同步）
    let parsedData = null;
    try {
      parsedData = JSON.parse(bodyText);
      // 提取 data 字段（API返回格式为 {code:0, data: {...}}）
      const cacheData = parsedData.data !== undefined ? parsedData.data : parsedData;
      await saveApiCacheToSupabase(endpointType, cacheData);
    } catch (e) {
      console.error(`[cache-manager] ⚠️ ${endpoint} 写入Supabase失败:`, e.message);
    }
    
    // 记录积分消耗（今日密码 × 1 Token）
    await logPointsConsumption(apiPath, startTime, 'cache-manager', 'internal', 1);
    
    console.log(`[cache-manager] ✅ 单个缓存刷新完成: ${endpoint}`);
    
    // 尝试解析 JSON 数据以便前端展示
    try {
      parsedData = JSON.parse(bodyText);
    } catch (e) {
      parsedData = bodyText;
    }

    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: '缓存刷新成功',
        endpoint: endpoint,
        duration: duration,
        points_used: 1,
        raw_data: parsedData,  // 🆕 返回实际数据供前端展示
      }),
    };
    
  } catch (e) {
    console.error(`[cache-manager] ❌ 单个缓存刷新异常:`, e.message);
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: -1,
        msg: '刷新失败: ' + e.message,
      }),
    };
  }
}

// ══════════════════════════════════════════════════
// 🔥 刷新今日制造（分别调用4个工作台，每个消耗1 Token）
// ══════════════════════════════════════════════════
async function handleRefreshManufacture(baseHeaders) {
  console.log('[cache-manager] 🔄 开始刷新今日制造（4个工作台）...');
  
  const baseUrl = `${BASE_URL}/v1/sjz_api/manufacturePro`;
  const workshops = [1, 2, 3, 4]; // 1技术中心 2工作台 3制药台 4防具台
  const level = 3; // 默认等级3
  const results = {};
  let totalDuration = 0;
  let pointsUsed = 0;
  
  // 分别调用4个工作台
  for (const t of workshops) {
    const startTime = Date.now();
    const params = new URLSearchParams();
    params.set('token', DATA_SOURCE_TOKEN);
    params.set('t', t);
    params.set('l', level);
    const targetUrl = `${baseUrl}?${params}`;
    
    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const duration = Date.now() - startTime;
      totalDuration += duration;
      
      if (!resp.ok) {
        console.error(`[cache-manager] ❌ manufacturePro?t=${t}&l=${level} 失败: HTTP ${resp.status}`);
        results[t] = [];
        continue;
      }
      
      const bodyText = await resp.text();
      let data = [];
      try {
        const parsed = JSON.parse(bodyText);
        // 提取 data 字段（兼容多种返回格式）
        if (parsed.data && Array.isArray(parsed.data)) {
          data = parsed.data;
        } else if (Array.isArray(parsed)) {
          data = parsed;
        }
      } catch (e) {
        console.error(`[cache-manager] ❌ manufacturePro?t=${t}&l=${level} JSON解析失败`);
      }
      
      results[t] = data;
      pointsUsed++;
      
      // 记录积分消耗（每个工作台 × 1 Token）
      await logPointsConsumption('/v1/sjz_api/manufacturePro', startTime, 'cache-manager', 'internal', 1);
      
      console.log(`[cache-manager] ✅ manufacturePro?t=${t}&l=${level} 成功 (${duration}ms, ${data.length}件)`);
    } catch (e) {
      console.error(`[cache-manager] ❌ manufacturePro?t=${t}&l=${level} 异常:`, e.message);
      results[t] = [];
    }
  }
  
  // 组合数据：{1: [...], 2: [...], 3: [...], 4: [...]}
  const combinedData = results;
  
  // 写入Supabase缓存（替代Blob缓存，实现多设备同步）
  try {
    await saveApiCacheToSupabase('manufacture', combinedData);
    console.log(`[cache-manager] ✅ manufacture 已写入Supabase（4个工作台，等级${level}）`);
  } catch (e) {
    console.error(`[cache-manager] ⚠️ manufacture 写入Supabase失败:`, e.message);
  }
  
  console.log(`[cache-manager] ✅ 今日制造刷新完成（总耗时${totalDuration}ms，消耗${pointsUsed}积分）`);
  
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({
      ret: 0,
      msg: '今日制造刷新成功（4个工作台，等级' + level + '）',
      endpoint: '/v1/sjz_api/manufacturePro',
      duration: totalDuration,
      points_used: pointsUsed,
      raw_data: combinedData,  // 返回组合后的数据供前端展示
    }),
  };
}

// ══════════════════════════════════════════════════
// 🔥 刷新卡战备（每档位单独API调用 + 过滤兑换组 + 排序取前10）
// ══════════════════════════════════════════════════
// 说明：
//   - 每档位独立请求，需传 lv 参数
//   - 每次请求消耗2 Token
//   - 共5个档位(LV 0,1,2,3,5)，LV4(24W适应监狱)仅周五12:00~周一00:00开放

const ZB_LV_LEVELS = [0, 1, 2, 3, 5];
const ZB_LV_LABELS = {0: '11W', 1: '18W', 2: '55W', 3: '60W', 5: '78W'};

async function refreshCardZhanbeiInternal() {
  const startTime = Date.now();
  const results = {};
  ZB_LV_LEVELS.forEach(function(lv) { results[lv] = { data: [] }; });

  let pointsUsed = 0;

  for (const lv of ZB_LV_LEVELS) {
    const lvStartTime = Date.now();
    const targetUrl = `${BASE_URL}/v1/sjz_api/jzv3_zb?token=${DATA_SOURCE_TOKEN}&lv=${lv}`;

    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!resp.ok) {
        console.error(`[cache-manager] ❌ jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 失败: HTTP ${resp.status}`);
        continue;
      }

      const bodyText = await resp.text();
      let groups = [];
      try {
        const parsed = JSON.parse(bodyText);
        // 🔍 调试：打印V3响应结构
        console.log(`[cache-manager] 🔍 jzv3_zb LV=${lv} 响应类型:`, typeof parsed, `键:`, Object.keys(parsed).join(','));
        if (parsed.data !== undefined) {
          console.log(`[cache-manager] 🔍 jzv3_zb LV=${lv} parsed.data 类型:`, typeof parsed.data, Array.isArray(parsed.data) ? '(数组)' : '(非数组)');
          if (!Array.isArray(parsed.data) && typeof parsed.data === 'object') {
            console.log(`[cache-manager] 🔍 jzv3_zb LV=${lv} parsed.data 键:`, Object.keys(parsed.data).join(','));
            // 尝试从 data 的子字段找数组
            for (var k in parsed.data) {
              if (Array.isArray(parsed.data[k])) {
                console.log(`[cache-manager] 🔍 jzv3_zb LV=${lv} 从 data.${k} 找到数组, 长度:`, parsed.data[k].length);
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
        if (groups.length === 0) {
          console.log(`[cache-manager] ⚠️ jzv3_zb LV=${lv} 未能从响应中提取数组, 响应预览:`, bodyText.slice(0, 300));
        }
      } catch (e) {
        console.error(`[cache-manager] ❌ jzv3_zb LV=${lv} JSON解析失败:`, e.message);
        continue;
      }

      console.log(`[cache-manager] jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 原始组数: ${groups.length}`);

      // 1. 过滤：排除名称含"兑换"的组
      const filtered = groups.filter(function(g) {
        const name = g.name || g.title || g.label || '';
        return name.indexOf('兑换') === -1;
      });

      // 2. 计算总花费并排序（升序）
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
      console.log(`[cache-manager] jzv3_zb LV=${lv} (${ZB_LV_LABELS[lv]}) 过滤后: ${filtered.length}组, 取前10: ${top10.length}组`);

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
      await logPointsConsumption('/v1/sjz_api/jzv3_zb', lvStartTime, 'cache-manager', 'internal', 2);
      pointsUsed += 2;
      console.log(`[cache-manager] 💰 jzv3_zb LV=${lv} 已消耗2 Token`);

    } catch (e) {
      console.error(`[cache-manager] ❌ jzv3_zb LV=${lv} 异常:`, e.message);
    }
  }

  // 写入Supabase缓存
  try {
    await saveApiCacheToSupabase('card_zhanbei', results);
    console.log(`[cache-manager] card_zhanbei 已写入Supabase（${ZB_LV_LEVELS.length}个档位: ${ZB_LV_LEVELS.join(', ')}）`);
  } catch (e) {
    console.error(`[cache-manager] card_zhanbei 写入Supabase失败:`, e.message);
  }

  console.log(`[cache-manager] ✅ jzv3_zb 全部档位处理完成 (${Date.now() - startTime}ms, 消耗${pointsUsed}积分)`);

  return {
    success: true,
    duration: Date.now() - startTime,
    points_used: pointsUsed,
    data: results,
  };
}

async function handleRefreshCardZhanbei(baseHeaders) {
  console.log('[cache-manager] 开始刷新卡战备V3（每档位单独请求: 档位0,1,2,3,5，过滤兑换组+排序取前10）...');
  const result = await refreshCardZhanbeiInternal();
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({
      ret: 0,
      msg: '卡战备V3刷新成功（5个档位单独请求，共消耗' + result.points_used + '积分，已过滤兑换组+取前10）',
      endpoint: '/v1/sjz_api/jzv3_zb',
      duration: result.duration,
      points_used: result.points_used,
      raw_data: result.data,
    }),
  };
}

// ══════════════════════════════════════════════════
// 🔥 手动刷新所有缓存（预热）
// ══════════════════════════════════════════════════
async function handleRefresh(baseHeaders) {
  console.log('[cache-manager] 🔥 开始预热所有缓存...');
  
  if (!DATA_SOURCE_TOKEN) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: 'DATA_SOURCE_TOKEN 未配置' }),
    };
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let totalPointsUsed = 0;

  for (const endpoint of WARM_ENDPOINTS) {
    try {
      // 卡战备V3：每档位单独请求，过滤兑换组+排序取前10，使用专用处理
      if (endpoint === '/v1/sjz_api/jzv3_zb') {
        console.log('[cache-manager] 正在刷新卡战备V3（每档位单独请求，过滤兑换组+排序取前10）...');
        const zbResult = await refreshCardZhanbeiInternal();
        if (zbResult.success) {
          results.push({
            endpoint: endpoint,
            status: 'success',
            duration: zbResult.duration,
            points_used: zbResult.points_used,
            cached: true,
          });
          successCount++;
          totalPointsUsed += zbResult.points_used;
        } else {
          results.push({
            endpoint: endpoint,
            status: 'failed',
            error: zbResult.error || '部分档位获取失败',
          });
          failCount++;
        }
        continue;
      }

      console.log(`[cache-manager] 正在刷新: ${endpoint}`);
      
      // 构造API请求URL
      const params = new URLSearchParams(endpoint.split('?')[1] || '');
      params.set('token', DATA_SOURCE_TOKEN);
      const apiPath = endpoint.split('?')[0];
      const targetUrl = `${BASE_URL}${apiPath}?${params}`;
      
      // 发起请求
      const startTime = Date.now();
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const duration = Date.now() - startTime;
      
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error(`[cache-manager] ❌ ${endpoint} 失败: HTTP ${resp.status}`);
        results.push({
          endpoint: endpoint,
          status: 'failed',
          error: `HTTP ${resp.status}: ${errText.slice(0, 100)}`,
          duration: duration,
        });
        failCount++;
        continue;
      }
      
      // 读取响应
      const bodyText = await resp.text();
      
      // 写入Supabase缓存（替代Blob缓存，实现多设备同步）
      let parsedData = null;
      try {
        parsedData = JSON.parse(bodyText);
        // 提取 data 字段，并映射 endpoint 到 cacheId
        const cacheId = endpointToCacheId(endpoint);
        if (cacheId) {
          const cacheData = parsedData.data !== undefined ? parsedData.data : parsedData;
          await saveApiCacheToSupabase(cacheId, cacheData);
        }
      } catch (e) {
        console.error(`[cache-manager] ⚠️ ${endpoint} 写入Supabase失败:`, e.message);
      }
      
      // 记录积分消耗（今日密码/制造 × 1 Token）
      await logPointsConsumption(apiPath, startTime, 'cache-manager', 'internal', 1);
      
      results.push({
        endpoint: endpoint,
        status: 'success',
        duration: duration,
        cached: true,
      });
      successCount++;
      
    } catch (e) {
      console.error(`[cache-manager] ❌ ${endpoint} 异常:`, e.message);
      results.push({
        endpoint: endpoint,
        status: 'error',
        error: e.message,
      });
      failCount++;
    }
  }

  console.log(`[cache-manager] ✅ 预热完成: 成功 ${successCount}, 失败 ${failCount}, 消耗积分 ${totalPointsUsed}`);

  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({
      ret: 0,
      msg: '缓存预热完成',
      summary: {
        total: WARM_ENDPOINTS.length,
        success: successCount,
        failed: failCount,
        points_used: totalPointsUsed,
      },
      results: results,
    }),
  };
}

// ══════════════════════════════════════════════════
// 📊 查看积分消耗日志统计
// ══════════════════════════════════════════════════
async function handleLogStats(baseHeaders) {
  try {
    // 从 Supabase 读取积分日志
    const { data: existing, error } = await getSupabase()
      .from('api_cache')
      .select('data')
      .eq('id', 'points_log')
      .single();
    
    if (error || !existing || !existing.data) {
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({
          ret: 0,
          msg: '暂无积分消耗记录',
          stats: {
            initial_points: 0,
            total_points_consumed: 0,
            remaining_points: 0,
            total_calls: 0,
            last_24h_calls: 0,
            endpoint_stats: {},
            logs: [],
          },
        }),
      };
    }
    
    const data = existing.data;
    const initialPoints = data.initial_points || 0;
    const totalPointsConsumed = data.total_points_consumed || 0;
    
    // 统计最近24小时
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentLogs = data.logs.filter(log => log.timestamp > last24h);
    
    // 统计各接口消耗次数
    const endpointStats = {};
    data.logs.forEach(log => {
      const ep = log.endpoint.split('?')[0]; // 去掉参数
      if (!endpointStats[ep]) {
        endpointStats[ep] = { count: 0, last_time: null };
      }
      endpointStats[ep].count++;
      if (!endpointStats[ep].last_time || log.timestamp > endpointStats[ep].last_time) {
        endpointStats[ep].last_time = log.timestamp;
      }
    });
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: '积分消耗日志统计',
        stats: {
          initial_points: initialPoints,
          total_points_consumed: totalPointsConsumed,
          remaining_points: initialPoints - totalPointsConsumed,
          total_calls: data.total_calls || data.logs.length,
          last_24h_calls: recentLogs.length,
          endpoint_stats: endpointStats,
          last_updated: data.last_updated,
          logs: data.logs.slice(0, 50),
        },
      }),
    };
  } catch (e) {
    console.error('[cache-manager] ❌ 日志读取失败:', e.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '日志读取失败: ' + e.message }),
    };
  }
}

// ══════════════════════════════════════════════════
// 🗑️ 清空缓存
// ══════════════════════════════════════════════════
async function handleClear(baseHeaders) {
  const clearedItems = [];
  
  // 1. 尝试清除Netlify Blobs（如果配置了的话）
  try {
    const store = getStore('api-cache');
    await store.delete('v1:/v1/sjz_api/jzv3_zb');
    await store.delete('v1:/v1/sjz_api/manufacturePro');
    await store.delete('v1:/v1/sjz_api/map_pwd');
    clearedItems.push('Netlify_Blobs');
    console.log('[cache-manager] 🗑️ Netlify Blobs缓存已清空');
  } catch (e) {
    console.log('[cache-manager] ℹ️ Netlify Blobs未配置或不可用，跳过');
  }
  
  // 2. 清除Supabase中的缓存
  try {
    const cacheIds = ['map_pwd', 'manufacture', 'card_zhanbei'];
    for (const cacheId of cacheIds) {
      const { error } = await getSupabase()
        .from('api_cache')
        .delete()
        .eq('id', cacheId);
      
      if (error) {
        console.error(`[cache-manager] ❌ 清除Supabase ${cacheId} 失败:`, error.message);
      } else {
        console.log(`[cache-manager] ✅ 清除Supabase api_cache: ${cacheId}`);
      }
    }
    clearedItems.push('Supabase_api_cache');
  } catch (e) {
    console.error('[cache-manager] ❌ 清除Supabase缓存异常:', e.message);
  }
  
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({
      ret: 0,
      msg: '缓存已清空（包含Netlify Blobs和Supabase）',
      cleared: clearedItems,
    }),
  };
}

// ══════════════════════════════════════════════════
// 🗑️ 清除单个缓存
// ══════════════════════════════════════════════════
async function handleClearSingle(baseHeaders, cacheId) {
  if (!cacheId) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '缺少 cache_id 参数' }),
    };
  }
  
  // cacheId 到 Supabase id 的映射
  const cacheIdMap = {
    'map_pwd': 'map_pwd',
    'manufacture': 'manufacture',
    'card_zhanbei': 'card_zhanbei',
  };
  
  // cacheId 到 Blob endpoint key 的映射
  const cacheIdToBlobKey = {
    'map_pwd': 'v1:/v1/sjz_api/map_pwd',
    'manufacture': 'v1:/v1/sjz_api/manufacturePro',
    'card_zhanbei': 'v1:/v1/sjz_api/jzv3_zb',
  };
  
  const supabaseId = cacheIdMap[cacheId];
  const blobKey = cacheIdToBlobKey[cacheId];
  
  if (!supabaseId) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '无效的 cache_id: ' + cacheId }),
    };
  }
  
  const clearedItems = [];
  
  // 1. 清除 Netlify Blobs
  try {
    const store = getStore('api-cache');
    await store.delete(blobKey);
    clearedItems.push('Netlify_Blobs');
    console.log(`[cache-manager] 🗑️ 已删除 Blobs: ${blobKey}`);
  } catch (e) {
    console.log('[cache-manager] ℹ️ Netlify Blobs 跳过');
  }
  
  // 2. 清除 Supabase
  try {
    const { error } = await getSupabase()
      .from('api_cache')
      .delete()
      .eq('id', supabaseId);
    
    if (error) {
      console.error(`[cache-manager] ❌ 清除 Supabase ${supabaseId} 失败:`, error.message);
    } else {
      console.log(`[cache-manager] ✅ 已删除 Supabase api_cache: ${supabaseId}`);
      clearedItems.push('Supabase');
    }
  } catch (e) {
    console.error('[cache-manager] ❌ 清除 Supabase 异常:', e.message);
  }
  
  return {
    statusCode: 200,
    headers: baseHeaders,
    body: JSON.stringify({
      ret: 0,
      msg: '缓存已删除: ' + cacheId,
      cleared: clearedItems,
    }),
  };
}

// ══════════════════════════════════════════════════
// 🔄 同步剩余 Token（修正 initial_points）
// ══════════════════════════════════════════════════
async function handleSyncRemaining(baseHeaders, remainingParam) {
  try {
    const remaining = parseInt(remainingParam);
    if (isNaN(remaining) || remaining < 0) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: JSON.stringify({ ret: -1, msg: '参数错误：请提供正确的剩余Token数量，如 ?remaining=1231' }),
      };
    }
    
    // 读取当前积分日志
    const { data: existing, error } = await getSupabase()
      .from('api_cache')
      .select('data')
      .eq('id', 'points_log')
      .single();
    
    let totalPointsConsumed = 0;
    let logs = [];
    let totalCalls = 0;
    
    if (!error && existing && existing.data) {
      totalPointsConsumed = existing.data.total_points_consumed || 0;
      logs = existing.data.logs || [];
      totalCalls = existing.data.total_calls || logs.length;
    }
    
    // 计算正确的 initial_points
    // 现有公式: remaining = initial_points - total_points_consumed
    // 所以: initial_points = remaining + total_points_consumed
    const newInitialPoints = remaining + totalPointsConsumed;
    
    // 写入更新后的日志
    const { error: upsertError } = await getSupabase()
      .from('api_cache')
      .upsert({
        id: 'points_log',
        data: {
          initial_points: newInitialPoints,
          last_updated: Date.now(),
          total_calls: totalCalls,
          total_points_consumed: totalPointsConsumed,
          logs: logs,
        },
      });
    
    if (upsertError) {
      console.error('[cache-manager] ❌ 同步积分日志失败:', upsertError.message);
      return {
        statusCode: 500,
        headers: baseHeaders,
        body: JSON.stringify({ ret: -1, msg: '同步失败: ' + upsertError.message }),
      };
    }
    
    console.log(`[cache-manager] ✅ 剩余Token已同步: initial_points=${newInitialPoints}, 剩余=${remaining}, 已消耗=${totalPointsConsumed}`);
    
    // 同时记录一条同步日志
    await logPointsConsumption('/admin/sync_remaining', Date.now(), 'cache-manager', 'internal', 0);
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: '剩余Token已同步',
        sync: {
          old_initial_points: existing?.data?.initial_points || 0,
          new_initial_points: newInitialPoints,
          total_points_consumed: totalPointsConsumed,
          remaining: remaining,
          total_calls: totalCalls,
        },
      }),
    };
  } catch (e) {
    console.error('[cache-manager] ❌ 同步异常:', e.message);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '同步异常: ' + e.message }),
    };
  }
}

// ══════════════════════════════════════════════════
// 📈 查看缓存状态
// ══════════════════════════════════════════════════
async function handleStatus(baseHeaders) {
  try {
    const store = getStore('api-cache');
    
    // 检查各接口缓存状态
    const cacheStatus = {};
    
    for (const endpoint of WARM_ENDPOINTS) {
      const cacheKey = 'v1:' + endpoint;
      try {
        const cached = await store.getJSON(cacheKey);
        if (cached && cached.ts) {
          const age = Math.floor((Date.now() - cached.ts) / 1000);
          cacheStatus[endpoint] = {
            cached: true,
            age_seconds: age,
            age_human: formatAge(age),
            last_updated: new Date(cached.ts).toISOString(),
          };
        } else {
          cacheStatus[endpoint] = { cached: false };
        }
      } catch (e) {
        cacheStatus[endpoint] = { cached: false, error: e.message };
      }
    }
    
    // 统计缓存覆盖率
    const cachedCount = Object.values(cacheStatus).filter(s => s.cached).length;
    const coverage = Math.round(cachedCount / WARM_ENDPOINTS.length * 100);
    
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({
        ret: 0,
        msg: '缓存状态',
        summary: {
          total_endpoints: WARM_ENDPOINTS.length,
          cached: cachedCount,
          coverage: coverage + '%',
        },
        cache_status: cacheStatus,
      }),
    };
  } catch (e) {
    console.error('[cache-manager] ❌ 状态查询失败:', e.message);
    
    // 检测是否是Netlify Blobs配置问题（siteID 或 sitelD 拼写都检测）
    if (e.message && e.message.includes('Netlify Blobs')) {
      return {
        statusCode: 200,
        headers: baseHeaders,
        body: JSON.stringify({ 
          ret: 0, 
          msg: 'Netlify Blobs未配置（已切换到Supabase缓存模式）',
          summary: { total_endpoints: WARM_ENDPOINTS.length, cached: 0, coverage: '0%' },
          cache_status: {},
          note: '数据已迁移到Supabase，Blobs状态仅供参考',
        }),
      };
    }
    
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ ret: -1, msg: '状态查询失败: ' + e.message }),
    };
  }
}

// ══════════════════════════════════════════════════
// 💰 记录积分消耗日志（内部函数）
// ══════════════════════════════════════════════════
async function logPointsConsumption(endpoint, timestamp, userAgent, ip, pointsCost = 2) {
  try {
    const logEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      endpoint: endpoint,
      timestamp: timestamp,
      time_str: new Date(timestamp).toISOString(),
      user_agent: userAgent || 'unknown',
      ip: ip || 'unknown',
      type: 'admin_refresh',
      cost: pointsCost,
    };
    
    // 从 Supabase 读取现有日志
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
    
    // 添加新日志（保留最近100条）
    logs.unshift(logEntry);
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
    
    // 保存到 Supabase
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
      console.error('[cache-manager] ❌ 积分日志写入失败:', upsertError.message);
    } else {
      console.log(`[cache-manager] 💰 积分消耗已记录 | ${endpoint} | -${pointsCost}积分 | ${logEntry.time_str}`);
    }
  } catch (e) {
    console.error('[cache-manager] ❌ 积分日志写入异常:', e.message);
  }
}

// ══════════════════════════════════════════════════
// 🛠️ 工具函数：格式化时间差
// ══════════════════════════════════════════════════
function formatAge(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
  return `${Math.floor(seconds / 86400)}天`;
}