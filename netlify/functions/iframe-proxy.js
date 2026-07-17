/**
 * Netlify Function — 网页代理（安全加固版）
 * URL: /.netlify/functions/iframe-proxy?url=目标网址
 *
 * 安全措施：
 * 1. URL 白名单：仅允许代理指定域名
 * 2. SSRF 防护：禁止访问内网/私有 IP
 * 3. Origin 校验：仅允许来自本站的请求
 */

// ==== 安全配置 ====
// 允许的源域名
const ALLOWED_ORIGINS = [
  'localhost',
  '127.0.0.1',
  // 在此添加你的生产域名
];

// URL 白名单（仅允许代理这些域名的资源）
// 如果你不需要 iframe-proxy，可以直接删除此文件
const ALLOWED_URL_HOSTNAMES = [
  // 示例：'example.com',
];

// 内网/私有 IP 段（SSRF 防护）
const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '127.',
  '0.',
  'localhost',
];

function isAllowedOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const referer = event.headers?.referer || event.headers?.Referer || '';
  const host = event.headers?.host || event.headers?.Host || '';

  if (host.includes('localhost') || host.includes('127.0.0.1')) return true;

  const checkList = [origin, referer];
  for (const val of checkList) {
    if (!val) continue;
    try {
      const h = new URL(val).hostname;
      if (ALLOWED_ORIGINS.some(d => h === d || h.endsWith('.' + d))) return true;
    } catch {}
  }

  const hasCustomDomains = ALLOWED_ORIGINS.some(d => d !== 'localhost' && d !== '127.0.0.1');
  if (!hasCustomDomains) return true;
  return false;
}

// SSRF 防护：检查 URL 是否指向内网
function isPrivateHost(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  return BLOCKED_IP_PREFIXES.some(p => lower === p.slice(0, -1) || lower.startsWith(p) || lower.endsWith('.internal') || lower === 'localhost');
}

exports.handler = async function (event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': origin || 'same-origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  // ==== 安全检查 1：验证来源 ====
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, headers, body: '<html><body><h1>拒绝访问：来源不受信任</h1></body></html>' };
  }

  // OPTIONS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // ==== 安全检查 2：只允许 GET ====
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: '<html><body><h1>仅支持 GET 请求</h1></body></html>' };
  }

  // ==== 如果白名单为空，直接禁用此功能 ====
  if (ALLOWED_URL_HOSTNAMES.length === 0) {
    return { statusCode: 403, headers, body: '<html><body><h1>此功能已禁用</h1><p>如需启用 iframe-proxy，请在代码中配置 ALLOWED_URL_HOSTNAMES 白名单。</p></body></html>' };
  }

  try {
    const targetUrl = event.queryStringParameters?.url || '';
    if (!targetUrl) {
      return { statusCode: 400, headers, body: '<html><body><h1>错误：缺少 url 参数</h1></body></html>' };
    }

    // ==== 安全检查 3：验证 URL 协议 ====
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { statusCode: 400, headers, body: '<html><body><h1>错误：无效的 URL</h1></body></html>' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { statusCode: 403, headers, body: '<html><body><h1>拒绝访问：仅允许 HTTP/HTTPS 协议</h1></body></html>' };
    }

    // ==== 安全检查 4：SSRF 防护 — 禁止内网 IP ====
    if (isPrivateHost(parsed.hostname)) {
      return { statusCode: 403, headers, body: '<html><body><h1>拒绝访问：禁止访问内网地址</h1></body></html>' };
    }

    // ==== 安全检查 5：URL 白名单验证 ====
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_URL_HOSTNAMES.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return { statusCode: 403, headers, body: '<html><body><h1>拒绝访问：目标域名不在白名单内</h1></body></html>' };
    }

    // 请求目标网页（带超时）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const html = await resp.text();

    return { statusCode: resp.status, headers, body: html };
  } catch (err) {
    return { statusCode: 500, headers, body: `<html><body><h1>加载失败：${err.message}</h1></body></html>` };
  }
};