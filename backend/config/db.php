<?php
// Simple Database Connection
$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: (file_exists('/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock') ? '3307' : '3306');
$db   = getenv('DB_NAME') ?: 'campusflow';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

$socket = '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';

$pdo = null;
$dsns = [];

// Try socket if file exists
if (file_exists($socket)) {
    $dsns[] = "mysql:unix_socket=$socket;dbname=$db;charset=utf8mb4";
}
// Try configured host and port
$dsns[] = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
// Fallback to 3306 if different
if ($port !== '3306') {
    $dsns[] = "mysql:host=$host;port=3306;dbname=$db;charset=utf8mb4";
}

$lastError = null;
foreach ($dsns as $dsn) {
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        break;
    } catch (PDOException $e) {
        $lastError = $e->getMessage();
    }
}

if (!$pdo) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $lastError]);
    exit();
}
