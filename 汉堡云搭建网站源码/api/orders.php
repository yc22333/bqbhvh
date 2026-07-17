<?php
/**
 * orders.php — AW子弹订单接口（GET/POST/PUT/DELETE）
 * 等价：Node.js 版 /api/orders
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        $data = db_get_all('awm_orders', ['orderBy' => 'created_at', 'orderDir' => 'desc']);
        json_response(['ret' => 0, 'data' => $data]);
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
        $bullet_count = isset($input['bullet_count']) ? intval($input['bullet_count']) : 0;
        $total_price = isset($input['total_price']) ? floatval($input['total_price']) : 0;
        $customer_type = isset($input['customer_type']) ? safe_str($input['customer_type'], 20) : '打手上号';
        $notes = isset($input['notes']) ? safe_str($input['notes'], 500) : '';
        $order_number = isset($input['order_number']) ? safe_str($input['order_number'], 50) : '';
        $settled = isset($input['settled']) ? ($input['settled'] ? 1 : 0) : 0;
        $created_at = isset($input['created_at']) ? safe_str($input['created_at'], 30) : date('Y-m-d H:i:s');

        if ($bullet_count <= 0 || $bullet_count > 99999) {
            json_response(['ret' => -1, 'msg' => '子弹数量无效'], 400);
        }
        if ($total_price <= 0 || $total_price > 999999) {
            json_response(['ret' => -1, 'msg' => '总价无效'], 400);
        }

        $insertData = [
            'bullet_count' => $bullet_count,
            'total_price' => $total_price,
            'customer_type' => $customer_type,
            'notes' => $notes,
        ];
        if ($order_number !== '') $insertData['order_number'] = $order_number;
        $insertData['settled'] = $settled;
        $insertData['created_at'] = $created_at;

        $data = db_insert('awm_orders', $insertData);
        json_response(['ret' => 0, 'data' => $data]);
    }

    if ($method === 'PUT') {
        require_admin();

        $input = get_input();
        $id = isset($input['id']) ? intval($input['id']) : 0;
        if ($id <= 0) {
            json_response(['ret' => -1, 'msg' => '缺少记录 ID'], 400);
        }

        $updateData = [];
        if (isset($input['bullet_count'])) {
            $bc = intval($input['bullet_count']);
            if ($bc <= 0 || $bc > 99999) json_response(['ret' => -1, 'msg' => '子弹数量无效'], 400);
            $updateData['bullet_count'] = $bc;
        }
        if (isset($input['total_price'])) {
            $tp = floatval($input['total_price']);
            if ($tp <= 0 || $tp > 999999) json_response(['ret' => -1, 'msg' => '总价无效'], 400);
            $updateData['total_price'] = $tp;
        }
        if (isset($input['customer_type'])) $updateData['customer_type'] = safe_str($input['customer_type'], 20);
        if (isset($input['notes'])) $updateData['notes'] = safe_str($input['notes'], 500);
        if (isset($input['settled'])) $updateData['settled'] = $input['settled'] ? 1 : 0;

        if (count($updateData) > 0) {
            db_update('awm_orders', $id, $updateData);
        }
        $data = db_get('awm_orders', ['id' => $id]);
        json_response(['ret' => 0, 'data' => $data]);
    }

    if ($method === 'DELETE') {
        require_admin();

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if ($id <= 0) {
            json_response(['ret' => -1, 'msg' => '缺少记录 ID'], 400);
        }
        db_delete('awm_orders', ['id' => $id]);
        json_response(['ret' => 0, 'msg' => '已删除']);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);