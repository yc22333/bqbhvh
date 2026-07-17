<?php
/**
 * api-reader.php — API缓存读取接口（卡战备/制造/地图密码）
 * GET: /api/api-reader.php?endpoint=card_zhanbei
 * 等价：Node.js 版 /api/api-reader
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';
        if ($endpoint === '') {
            json_response(['ret' => -1, 'msg' => '缺少 endpoint 参数'], 400);
        }

        $data = db_get('api_cache', ['cache_key' => $endpoint]);
        if (!$data) {
            json_response([
                'ret' => 404,
                'msg' => '暂无缓存数据',
                'endpoint' => $endpoint,
                'cache_id' => $endpoint,
            ]);
        }

        $parsedData = $data['data'];
        $decoded = json_decode($data['data'], true);
        if (json_last_error() === JSON_ERROR_NONE && $decoded !== null) {
            $parsedData = $decoded;
        }

        json_response([
            'ret' => 0,
            'msg' => '读取成功',
            'endpoint' => $endpoint,
            'cache_id' => $endpoint,
            'updated_at' => isset($data['updated_at']) ? $data['updated_at'] : date('Y-m-d H:i:s'),
            'data' => $parsedData,
        ]);
    } catch (Exception $e) {
        json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
    }
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);