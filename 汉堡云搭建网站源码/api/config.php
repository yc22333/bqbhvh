<?php
/**
 * config.php — 比奇堡报价单 · PHP 数据库核心模块
 * 功能：SQLite3 数据库连接、初始化、通用CRUD
 * 环境：PHP 7.4+，虚拟主机（Apache + mod_php）
 */

// ════════════════════════════════════════════════════════════════
// ① 环境自检
// ════════════════════════════════════════════════════════════════

// 检查 SQLite3 扩展
if (!extension_loaded('SQLite3') && !class_exists('SQLite3', false)) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'ret' => -1,
        'error' => 'PHP_SQLITE3_NOT_ENABLED',
        'msg' => '服务器未启用 SQLite3 扩展，请在虚拟主机后台启用 PHP SQLite3 扩展',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ════════════════════════════════════════════════════════════════
// ② 数据库路径
// ════════════════════════════════════════════════════════════════

define('DB_PATH', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'database.sqlite');

// 确保 data 目录存在且可写
$dbDir = dirname(DB_PATH);
if (!is_dir($dbDir)) {
    @mkdir($dbDir, 0755, true);
}
if (!is_writable($dbDir)) {
    @chmod($dbDir, 0755);
}

// ════════════════════════════════════════════════════════════════
// ③ HTTP 头（CORS + JSON）
// ════════════════════════════════════════════════════════════════

// 只在真正输出 JSON 时设置 Content-Type，先设置 CORS
if (!headers_sent()) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
}

// 处理 OPTIONS 预检请求
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ════════════════════════════════════════════════════════════════
// ④ 数据库单例
// ════════════════════════════════════════════════════════════════

function get_db() {
    static $db = null;
    if ($db === null) {
        $dbPath = DB_PATH;
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        try {
            $db = new SQLite3($dbPath);
            $db->enableExceptions(true);
            $db->busyTimeout(5000);
            @$db->exec('PRAGMA journal_mode = WAL');
            $db->exec('PRAGMA foreign_keys = ON');
            $db->exec('PRAGMA encoding = UTF-8');
        } catch (Exception $e) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'ret' => -1,
                'error' => 'SQLITE_CONNECT_FAILED',
                'msg' => '数据库连接失败：' . $e->getMessage() . '（请确认 data 目录有写入权限）',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $db;
}

// ════════════════════════════════════════════════════════════════
// ⑤ 初始化数据库（建表）
// ════════════════════════════════════════════════════════════════

function db_init() {
    $db = get_db();

    // ① 物品数据表
    $db->exec("CREATE TABLE IF NOT EXISTS game_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objectId TEXT,
        objectName TEXT,
        primaryClass TEXT,
        secondClass TEXT,
        thirdClass TEXT,
        itemType TEXT,
        itemSubType TEXT,
        description TEXT,
        gridSize TEXT,
        basePrice REAL DEFAULT 0,
        avgPrice REAL DEFAULT 0,
        minPrice REAL DEFAULT 0,
        maxPrice REAL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ② AW子弹订单表
    $db->exec("CREATE TABLE IF NOT EXISTS awm_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT,
        bullet_count INTEGER DEFAULT 0,
        total_price REAL DEFAULT 0,
        customer_type TEXT DEFAULT '打手上号',
        notes TEXT DEFAULT '',
        settled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ③ 赞赏记录表
    $db->exec("CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT DEFAULT '匿名',
        amount REAL DEFAULT 0,
        message TEXT DEFAULT '',
        order_number TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ④ 系统日志表
    $db->exec("CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT DEFAULT 'info',
        text TEXT DEFAULT '',
        time TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ⑤ 物品价格表
    $db->exec("CREATE TABLE IF NOT EXISTS item_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        price REAL DEFAULT 0,
        source TEXT DEFAULT 'manual',
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ⑥ API 缓存表
    $db->exec("CREATE TABLE IF NOT EXISTS api_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE,
        data TEXT,
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )");

    // ⑦ 管理员配置表
    $db->exec("CREATE TABLE IF NOT EXISTS admin_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE,
        config_value TEXT
    )");

    // 创建索引（提升查询速度）
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_game_items_name ON game_items(objectName)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_game_items_class ON game_items(primaryClass)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_awm_orders_created ON awm_orders(created_at)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key)");
}

// 自动初始化
db_init();

// ════════════════════════════════════════════════════════════════
// ⑥ 通用 CRUD 辅助函数
// ════════════════════════════════════════════════════════════════

function db_get($table, $conditions) {
    $db = get_db();
    $keys = array_keys($conditions);
    $values = array_values($conditions);
    $where = implode(' AND ', array_map(function($k) { return "$k = ?"; }, $keys));
    $sql = "SELECT * FROM $table WHERE $where LIMIT 1";
    $stmt = $db->prepare($sql);
    foreach ($values as $i => $v) {
        $stmt->bindValue($i + 1, $v);
    }
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    return $row ?: null;
}

function db_get_all($table, $opts = []) {
    $db = get_db();
    $sql = "SELECT * FROM $table";
    $params = [];

    if (isset($opts['where'])) {
        $keys = array_keys($opts['where']);
        $values = array_values($opts['where']);
        $sql .= ' WHERE ' . implode(' AND ', array_map(function($k) { return "$k = ?"; }, $keys));
        $params = $values;
    }

    if (isset($opts['orderBy'])) {
        $dir = (isset($opts['orderDir']) && strtolower($opts['orderDir']) === 'asc') ? 'ASC' : 'DESC';
        $sql .= " ORDER BY {$opts['orderBy']} $dir";
    }

    if (isset($opts['limit'])) {
        $sql .= " LIMIT ?";
        $params[] = $opts['limit'];
    }

    $stmt = $db->prepare($sql);
    foreach ($params as $i => $v) {
        $stmt->bindValue($i + 1, $v);
    }
    $result = $stmt->execute();
    $rows = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $rows[] = $row;
    }
    return $rows;
}

function db_insert($table, $data) {
    $db = get_db();
    $keys = array_keys($data);
    $values = array_values($data);
    $placeholders = implode(', ', array_fill(0, count($keys), '?'));
    $sql = "INSERT INTO $table (" . implode(', ', $keys) . ") VALUES ($placeholders)";
    $stmt = $db->prepare($sql);
    foreach ($values as $i => $v) {
        $stmt->bindValue($i + 1, $v);
    }
    $stmt->execute();
    $insertId = $db->lastInsertRowID();
    return array_merge(['id' => $insertId], $data);
}

function db_update($table, $id, $data) {
    $db = get_db();
    $keys = array_keys($data);
    $values = array_values($data);
    $setClause = implode(', ', array_map(function($k) { return "$k = ?"; }, $keys));
    $sql = "UPDATE $table SET $setClause WHERE id = ?";
    $stmt = $db->prepare($sql);
    foreach ($values as $i => $v) {
        $stmt->bindValue($i + 1, $v);
    }
    $stmt->bindValue(count($values) + 1, $id);
    $stmt->execute();
    return true;
}

function db_delete($table, $conditions) {
    $db = get_db();
    $keys = array_keys($conditions);
    $values = array_values($conditions);
    $where = implode(' AND ', array_map(function($k) { return "$k = ?"; }, $keys));
    $sql = "DELETE FROM $table WHERE $where";
    $stmt = $db->prepare($sql);
    foreach ($values as $i => $v) {
        $stmt->bindValue($i + 1, $v);
    }
    $stmt->execute();
    return true;
}

function db_delete_all($table) {
    $db = get_db();
    $db->exec("DELETE FROM $table");
    return true;
}

// ════════════════════════════════════════════════════════════════
// ⑦ 请求 / 响应辅助工具
// ════════════════════════════════════════════════════════════════

function get_input() {
    static $cache = null;
    if ($cache !== null) return $cache;

    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $cache = $decoded;
            return $cache;
        }
    }
    $cache = array_merge($_POST ?: [], $_GET ?: []);
    return $cache;
}

function json_response($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function get_admin_password() {
    $row = db_get('admin_config', ['config_key' => 'admin_password']);
    return $row ? $row['config_value'] : null;
}

function require_admin() {
    $input = get_input();
    $adminPass = isset($input['admin_pass']) ? $input['admin_pass'] :
                 (isset($_GET['admin_key']) ? $_GET['admin_key'] :
                 (isset($input['admin_key']) ? $input['admin_key'] : ''));

    if (empty($adminPass) && isset($_GET['admin_pass'])) {
        $adminPass = $_GET['admin_pass'];
    }

    $realPass = get_admin_password();

    // 首次部署未设置密码，允许通过
    if ($realPass === null) {
        return true;
    }

    if ($realPass !== $adminPass) {
        json_response(['ret' => -1, 'msg' => '管理员密码错误'], 403);
    }
    return true;
}

function safe_str($str, $maxLength = 500) {
    if ($str === null) return '';
    $str = (string)$str;
    if (function_exists('mb_strlen')) {
        if (mb_strlen($str) > $maxLength) {
            $str = mb_substr($str, 0, $maxLength);
        }
    } else {
        if (strlen($str) > $maxLength) {
            $str = substr($str, 0, $maxLength);
        }
    }
    return $str;
}