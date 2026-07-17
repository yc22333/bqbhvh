<?php
/**
 * test.php — 环境自检脚本
 * 使用方法：上传后访问 http://你的域名/test.php
 */

header('Content-Type: text/html; charset=utf-8');

$tests = [];

// ① PHP 版本
$phpVersion = phpversion();
$tests[] = [
    'name' => 'PHP 版本',
    'value' => $phpVersion,
    'ok' => version_compare($phpVersion, '7.0.0', '>='),
    'detail' => '需要 PHP 7.0 或更高版本',
];

// ② SQLite3 扩展
$tests[] = [
    'name' => 'SQLite3 扩展',
    'value' => extension_loaded('SQLite3') ? '已启用' : '未启用',
    'ok' => extension_loaded('SQLite3'),
    'detail' => extension_loaded('SQLite3') ? '正常，可以使用数据库' : '请在虚拟主机后台启用 SQLite3 扩展',
];

// ③ mbstring 扩展
$tests[] = [
    'name' => 'Mbstring 扩展',
    'value' => extension_loaded('mbstring') ? '已启用' : '未启用',
    'ok' => extension_loaded('mbstring'),
    'detail' => extension_loaded('mbstring') ? '正常，支持中文字符串' : '建议启用 mbstring 扩展',
];

// ④ mod_rewrite（伪静态）
$hasModRewrite = function_exists('apache_get_modules') && in_array('mod_rewrite', apache_get_modules());
$tests[] = [
    'name' => 'Mod_Rewrite (伪静态)',
    'value' => $hasModRewrite ? '已启用' : '无法检测',
    'ok' => true,
    'detail' => $hasModRewrite ? 'Apache mod_rewrite 已启用，.htaccess 可以生效' : '如果 .htaccess 生效则无需关心此项',
];

// ⑤ data 目录写入权限
$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}
$isWritable = is_writable($dataDir);
$tests[] = [
    'name' => 'data 目录写入权限',
    'value' => $isWritable ? '可写入' : '不可写入',
    'ok' => $isWritable,
    'detail' => $isWritable ? '正常，数据库文件可以创建' : '请在 FTP 中给 data 目录设置 755 或 777 权限',
];

// ⑥ 测试数据库连接
$dbTestOk = false;
$dbTestMsg = '';
try {
    if (extension_loaded('SQLite3')) {
        $testDb = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'test_check.sqlite';
        $db = new SQLite3($testDb);
        $db->exec("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, val TEXT)");
        $db->exec("INSERT INTO test (val) VALUES ('hello')");
        $result = $db->querySingle("SELECT val FROM test LIMIT 1");
        if ($result === 'hello') {
            $dbTestOk = true;
            $dbTestMsg = '数据库读写正常';
        } else {
            $dbTestMsg = '数据库读取出错';
        }
        $db->close();
        @unlink($testDb);
    } else {
        $dbTestMsg = 'SQLite3 未启用，无法测试';
    }
} catch (Exception $e) {
    $dbTestMsg = '测试失败: ' . $e->getMessage();
}
$tests[] = [
    'name' => 'SQLite 数据库读写测试',
    'value' => $dbTestOk ? '通过' : '失败',
    'ok' => $dbTestOk,
    'detail' => $dbTestMsg,
];

// ⑦ API 文件存在性
$apiFiles = ['items.php', 'orders.php', 'donations.php', 'logs.php', 'api-reader.php', 'cache-manager.php', 'admin-config.php', 'import-items.php', 'item-prices.php'];
$apiExists = true;
$missing = [];
foreach ($apiFiles as $f) {
    if (!file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . $f)) {
        $apiExists = false;
        $missing[] = $f;
    }
}
$tests[] = [
    'name' => 'API 文件完整性',
    'value' => $apiExists ? '全部存在 (' . count($apiFiles) . ' 个)' : '缺少文件',
    'ok' => $apiExists,
    'detail' => $apiExists ? 'api/ 目录下所有 PHP 接口文件都在' : '缺少：' . implode(', ', $missing),
];

// ⑧ config.php 存在性
$tests[] = [
    'name' => 'config.php 核心模块',
    'value' => file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'config.php') ? '存在' : '缺失',
    'ok' => file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'config.php'),
    'detail' => 'config.php 是所有 API 接口的依赖',
];

// ⑨ index.html 存在性
$tests[] = [
    'name' => 'index.html 主页面',
    'value' => file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'index.html') ? '存在' : '缺失',
    'ok' => file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'index.html'),
    'detail' => 'index.html 是网站首页',
];

// ⑩ 当前工作目录
$tests[] = [
    'name' => '网站根目录路径',
    'value' => __DIR__,
    'ok' => true,
    'detail' => '文件应上传到此目录',
];

// 渲染测试结果
$allOk = true;
foreach ($tests as $t) {
    if (!$t['ok']) $allOk = false;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>比奇堡报价单 · 环境自检</title>
<style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; color: #e94560; margin-bottom: 30px; }
    .test { background: #16213e; padding: 15px 20px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #888; }
    .test.ok { border-left-color: #4ade80; }
    .test.fail { border-left-color: #ef4444; }
    .test-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
    .test-value { color: #aaa; font-size: 14px; margin-bottom: 5px; }
    .test-detail { font-size: 13px; color: #ccc; }
    .status { float: right; font-weight: bold; }
    .ok .status { color: #4ade80; }
    .fail .status { color: #ef4444; }
    .summary { text-align: center; padding: 20px; margin: 30px 0; border-radius: 12px; font-size: 20px; font-weight: bold; }
    .summary.ok { background: #0f3d2e; color: #4ade80; }
    .summary.fail { background: #3d0f1a; color: #ef4444; }
    .footer { text-align: center; margin-top: 40px; padding: 20px; color: #666; font-size: 12px; }
    a { color: #e94560; }
    .link-list { background: #16213e; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .link-list a { display: block; padding: 8px 0; text-decoration: none; }
    .link-list a:hover { color: #ff6b8a; }
</style>
</head>
<body>

<h1>🐙 比奇堡报价单 · 环境自检</h1>

<div class="summary <?php echo $allOk ? 'ok' : 'fail'; ?>">
    <?php echo $allOk ? '✅ 环境检测全部通过！' : '⚠️ 检测到问题，请查看下方详情'; ?>
</div>

<?php foreach ($tests as $t): ?>
<div class="test <?php echo $t['ok'] ? 'ok' : 'fail'; ?>">
    <div class="test-name">
        <?php echo htmlspecialchars($t['name']); ?>
        <span class="status"><?php echo $t['ok'] ? '✅ 通过' : '❌ 失败'; ?></span>
    </div>
    <div class="test-value">当前：<?php echo htmlspecialchars($t['value']); ?></div>
    <div class="test-detail">说明：<?php echo htmlspecialchars($t['detail']); ?></div>
</div>
<?php endforeach; ?>

<div class="link-list">
    <h3>🔗 测试链接（点击逐一验证）：</h3>
    <a href="index.html">➡️ 访问网站首页</a>
    <a href="api/items.php">➡️ 测试物品数据 API</a>
    <a href="api/orders.php">➡️ 测试订单 API</a>
    <a href="api/api-reader.php?endpoint=test">➡️ 测试 API 缓存读取</a>
</div>

<div class="footer">
    PHP <?php echo htmlspecialchars($phpVersion); ?> · 请在确认所有功能正常后删除此 test.php 文件
</div>

</body>
</html>