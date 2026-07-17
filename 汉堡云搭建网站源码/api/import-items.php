<?php
/**
 * import-items.php — 物品批量导入接口（POST，需管理员）
 * 等价：Node.js 版 /api/import-items
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        require_admin();

        $input = get_input();
        $items = isset($input['items']) ? $input['items'] : null;
        if ($items === null || !is_array($items)) {
            json_response(['ret' => -1, 'msg' => '缺少物品数据'], 400);
        }

        $count = 0;
        foreach ($items as $item) {
            if (!is_array($item)) continue;
            if (!isset($item['objectName']) || $item['objectName'] === '') continue;

            $existing = db_get('game_items', ['objectName' => $item['objectName']]);
            if ($existing) {
                $updateData = [];
                foreach ($item as $k => $v) {
                    if ($k === 'id') continue;
                    $updateData[$k] = is_array($v) || is_object($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v;
                }
                if (count($updateData) > 0) {
                    db_update('game_items', $existing['id'], $updateData);
                }
            } else {
                $insertData = [];
                foreach ($item as $k => $v) {
                    $insertData[$k] = is_array($v) || is_object($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v;
                }
                db_insert('game_items', $insertData);
            }
            $count++;
        }

        json_response(['ret' => 0, 'msg' => '导入完成，共处理 ' . $count . ' 条']);
    } catch (Exception $e) {
        json_response(['ret' => -1, 'msg' => '导入失败: ' . $e->getMessage()], 500);
    }
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);