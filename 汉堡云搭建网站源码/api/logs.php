<?php
/**
 * logs.php — 系统日志接口（GET/POST/DELETE）
 * 等价：Node.js 版 /api/logs
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        $data = db_get_all('system_logs', ['orderBy' => 'created_at', 'orderDir' => 'desc', 'limit' => 500]);
        json_response(['ret' => 0, 'data' => $data ?: []);
    }

    if ($method === 'POST') {
        $input = get_input();
        $tag = isset($input['tag']) ? safe_str($input['tag'], 20) : 'info';
        $text = isset($input['text']) ? safe_str($input['text'], 500) : '';
        $time = isset($input['time']) ? safe_str($input['time'], 20) : date('H:i:s');

        if ($text === '') {
            json_response(['ret' => -1, 'msg' => '缺少日志内容'], 400);
        }

        $data = db_insert('system_logs', [
            'tag' => $tag,
            'text' => $text,
            'time' => $time,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        // 清理超出限制的旧日志
        $allLogs = db_get_all('system_logs', ['orderBy' => 'id', 'orderDir' => 'asc']);
        if (count($allLogs) > 500) {
            $toDelete = array_slice($allLogs, 0, count($allLogs) - 500);
            foreach ($toDelete as $log) {
                db_delete('system_logs', ['id' => $log['id']]);
            }
        }

        json_response(['ret' => 0, 'data' => $data]);
    }

    if ($method === 'DELETE') {
        require_admin();
        db_delete_all('system_logs');
        json_response(['ret' => 0, 'msg' => '已清空']);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);