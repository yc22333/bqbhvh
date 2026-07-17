<?php
/**
 * donations.php — 赞赏记录接口（GET/POST/DELETE）
 * 等价：Node.js 版 /api/donations
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        $data = db_get_all('donations', ['orderBy' => 'created_at', 'orderDir' => 'desc']);
        json_response(['ret' => 0, 'data' => $data ?: []);
    }

    if ($method === 'POST') {
        $adminCheck = get_admin_password();
        if ($adminCheck !== null) {
            $input = get_input();
            $pass = isset($input['admin_pass']) ? $input['admin_pass'] : '';
            if ($pass !== $adminCheck) {
                json_response(['ret' => -1, 'msg' => '管理员密码错误'], 403);
            }
        }

        $input = get_input();
        $nickname = isset($input['nickname']) ? safe_str($input['nickname'], 20) : '匿名';
        $amount = isset($input['amount']) ? floatval($input['amount']) : 0;
        $message = isset($input['message']) ? safe_str($input['message'], 200) : '';
        $order_number = isset($input['order_number']) ? safe_str($input['order_number'], 50) : '';

        if ($amount <= 0 || $amount > 999999) {
            json_response(['ret' => -1, 'msg' => '金额无效'], 400);
        }

        $data = db_insert('donations', [
            'nickname' => $nickname,
            'amount' => $amount,
            'message' => $message,
            'order_number' => $order_number,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
        json_response(['ret' => 0, 'data' => $data]);
    }

    if ($method === 'DELETE') {
        require_admin();

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id > 0) {
            db_delete('donations', ['id' => $id]);
        } else {
            db_delete_all('donations');
        }
        json_response(['ret' => 0, 'msg' => '已删除']);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);