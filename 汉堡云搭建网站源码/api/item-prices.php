<?php
/**
 * item-prices.php — 物品价格接口（GET/POST）
 * 等价：Node.js 版 /api/item-prices
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        $data = db_get_all('item_prices', ['orderBy' => 'updated_at', 'orderDir' => 'desc']);
        json_response(['ret' => 0, 'data' => $data ?: []);
    }

    if ($method === 'POST') {
        $input = get_input();
        $item_id = isset($input['item_id']) ? intval($input['item_id']) : 0;
        $price = isset($input['price']) ? floatval($input['price']) : 0;
        $source = isset($input['source']) ? safe_str($input['source'], 50) : 'manual';

        if ($item_id <= 0 || $price === 0) {
            json_response(['ret' => -1, 'msg' => '参数不完整'], 400);
        }

        $data = db_insert('item_prices', [
            'item_id' => $item_id,
            'price' => $price,
            'source' => $source,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        json_response(['ret' => 0, 'data' => $data]);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);