<?php
/**
 * items.php — 物品数据接口
 * GET: /api/items.php
 * 等价：Node.js 版 /api/items
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        $type = isset($_GET['type']) ? $_GET['type'] : '';
        $search = isset($_GET['search']) ? $_GET['search'] : '';
        $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 1000;

        if ($id > 0) {
            $data = db_get('game_items', ['id' => $id]);
            if (!$data) {
                json_response(['ret' => -1, 'msg' => '物品不存在'], 404);
            }
            json_response(['ret' => 0, 'data' => $data]);
        }

        $allData = db_get_all('game_items', ['orderBy' => 'id', 'orderDir' => 'asc']);

        if ($type !== '') {
            $allData = array_values(array_filter($allData, function($item) use ($type) {
                return isset($item['primaryClass']) && $item['primaryClass'] === $type;
            }));
        }

        if ($search !== '') {
            $kw = strtolower($search);
            $allData = array_values(array_filter($allData, function($item) use ($kw) {
                $name = isset($item['objectName']) ? strtolower($item['objectName']) : '';
                $second = isset($item['secondClass']) ? strtolower($item['secondClass']) : '';
                return strpos($name, $kw) !== false || strpos($second, $kw) !== false;
            }));
        }

        if ($limit < 1) $limit = 1000;
        if ($limit > 5000) $limit = 5000;
        if ($page < 1) $page = 1;
        $total = count($allData);
        $offset = ($page - 1) * $limit;
        $paged = array_slice($allData, $offset, $limit);

        json_response([
            'ret' => 0,
            'data' => $paged,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
        ]);
    } catch (Exception $e) {
        json_response(['ret' => -1, 'msg' => '服务器异常: ' . $e->getMessage()], 500);
    }
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);