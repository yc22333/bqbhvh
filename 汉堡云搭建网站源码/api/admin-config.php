<?php
/**
 * admin-config.php — 管理员配置接口（GET/POST）
 * 等价：Node.js 版 /api/admin-config
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

try {

    if ($method === 'GET') {
        $key = isset($_GET['key']) ? $_GET['key'] : '';
        if ($key === '') {
            $data = db_get_all('admin_config');
            json_response(['ret' => 0, 'data' => $data]);
        }
        $row = db_get('admin_config', ['config_key' => $key]);
        json_response(['ret' => 0, 'data' => $row ?: null]);
    }

    if ($method === 'POST') {
        // 设置密码时不需要验证（允许首次部署设置密码）
        $input = get_input();
        $config_key = isset($input['config_key']) ? $input['config_key'] : '';
        $config_value = isset($input['config_value']) ? $input['config_value'] : '';

        if ($config_key === '') {
            json_response(['ret' => -1, 'msg' => '缺少 config_key'], 400);
        }

        // 如果不是设置密码，需要验证
        if ($config_key !== 'admin_password') {
            require_admin();
        }

        $existing = db_get('admin_config', ['config_key' => $config_key]);
        if ($existing) {
            db_update('admin_config', $existing['id'], [
                'config_key' => $config_key,
                'config_value' => $config_value,
            ]);
        } else {
            db_insert('admin_config', [
                'config_key' => $config_key,
                'config_value' => $config_value,
            ]);
        }

        json_response(['ret' => 0, 'msg' => '配置已保存']);
    }

} catch (Exception $e) {
    json_response(['ret' => -1, 'msg' => $e->getMessage()], 500);
}

json_response(['ret' => -1, 'msg' => '方法不支持'], 405);