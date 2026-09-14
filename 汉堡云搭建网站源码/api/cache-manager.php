<?php
/**
 * cache-manager.php — 缓存管理接口（GET/POST，需管理员）
 * 等价：Node.js 版 /api/cache-manager
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        require_admin();
        $data = db_get_all('api_cache');
        json_response(['ret' => 0, 'data' => $data ?: []);
    }

    if ($method === 'POST') {
        require_admin();

        $input = get_input();
        $id = isset($input['id']) ? $input['id'] : '';
        if ($id === '') {
            json_response(['ret' => -1, 'msg' => '缺少缓存 ID'], 400);
        }

        $cacheData = isset($input['data']) ? $input['data'] : '';
        $strData = is_array($cacheData) || is_object($cacheData) ? json_encode($cacheData, JSON_UNESCAPED_UNICODE) : (string)$cacheData;

        $existing = db_get('api_cache', ['cache_key' => $id]);
        if ($existing) {
            db_update('api_cache', $existing['id'], [
                'data' => $strData,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        } else {
            db_insert('api_cache', [
                'cache_key' => $id,
                'data' => $strData,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        json_response(['ret' => 0, 'msg' => '缓存已更新']);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);