<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $_GET['action'] ?? ($input['action'] ?? 'list');

// 1. Admin 4 Stats
if ($action === 'stats') {
    checkUser('admin');
    $total = $pdo->query("SELECT COUNT(*) FROM tokens WHERE DATE(created_at) = CURDATE()")->fetchColumn();
    $waiting = $pdo->query("SELECT COUNT(*) FROM tokens WHERE status = 'waiting'")->fetchColumn();
    $completed = $pdo->query("SELECT COUNT(*) FROM tokens WHERE status = 'completed' AND DATE(created_at) = CURDATE()")->fetchColumn();
    $active = $pdo->query("SELECT COUNT(*) FROM services WHERE status = 'active'")->fetchColumn();
    
    // Service-wise queue information
    $services = $pdo->query("
        SELECT s.id, s.name, s.prefix, s.average_time, s.status,
               COUNT(CASE WHEN t.status = 'waiting' THEN 1 END) as waiting_count
        FROM services s
        LEFT JOIN tokens t ON s.id = t.service_id
        GROUP BY s.id
        ORDER BY s.id ASC
    ")->fetchAll();

    echo json_encode([
        'success'         => true,
        'total_today'     => (int)$total,
        'waiting'         => (int)$waiting,
        'completed'       => (int)$completed,
        'active_services' => (int)$active,
        'services'        => $services
    ]);
    exit();
}

// 2. Admin Add Service
if ($action === 'add') {
    checkUser('admin');
    $name = trim($input['name'] ?? '');
    $prefix = strtoupper(trim($input['prefix'] ?? ''));
    $avgTime = max(1, (int)($input['average_time'] ?? 5));

    if (empty($name) || empty($prefix)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please enter service name and prefix']);
        exit();
    }

    $ins = $pdo->prepare("INSERT INTO services (name, prefix, average_time, status) VALUES (?, ?, ?, 'active')");
    $ins->execute([$name, $prefix, $avgTime]);
    echo json_encode(['success' => true]);
    exit();
}

// 3. Admin Toggle Service (Activate / Deactivate)
if ($action === 'toggle') {
    checkUser('admin');
    $id = (int)($input['id'] ?? 0);
    $status = $input['status'] ?? 'active';
    $newStatus = ($status === 'active') ? 'inactive' : 'active';

    $upd = $pdo->prepare("UPDATE services SET status = ? WHERE id = ?");
    $upd->execute([$newStatus, $id]);
    echo json_encode(['success' => true]);
    exit();
}

// 4. List Active Services (for Student)
checkUser('student');
$stmt = $pdo->query("
    SELECT s.id, s.name, s.prefix, s.average_time, s.status,
           COUNT(CASE WHEN t.status = 'waiting' THEN 1 END) as waiting_count
    FROM services s
    LEFT JOIN tokens t ON s.id = t.service_id
    WHERE s.status = 'active'
    GROUP BY s.id
    ORDER BY s.id ASC
");
$services = $stmt->fetchAll();

echo json_encode(['success' => true, 'services' => $services]);
