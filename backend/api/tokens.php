<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $_GET['action'] ?? ($input['action'] ?? '');

// -------------------------------------------------------------
// STUDENT ACTIONS
// -------------------------------------------------------------

// 1. Generate Token
if ($action === 'generate') {
    $user = checkUser('student');
    $serviceId = (int)($input['service_id'] ?? 0);

    if ($serviceId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please select a service']);
        exit();
    }

    // Check duplicate active token
    $chk = $pdo->prepare("SELECT id FROM tokens WHERE student_id = ? AND service_id = ? AND status IN ('waiting', 'called', 'processing') LIMIT 1");
    $chk->execute([$user['id'], $serviceId]);
    if ($chk->fetch()) {
        echo json_encode(['success' => false, 'error' => 'You already have an active token for this service']);
        exit();
    }

    // Get service prefix
    $sStmt = $pdo->prepare("SELECT prefix FROM services WHERE id = ? AND status = 'active' LIMIT 1");
    $sStmt->execute([$serviceId]);
    $prefix = $sStmt->fetchColumn();

    if (!$prefix) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Service is currently unavailable']);
        exit();
    }

    // Next token number
    $nStmt = $pdo->prepare("SELECT COALESCE(MAX(token_number), 0) + 1 FROM tokens WHERE service_id = ?");
    $nStmt->execute([$serviceId]);
    $nextNum = (int)$nStmt->fetchColumn();

    $code = $prefix . '-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);

    // Insert
    $ins = $pdo->prepare("INSERT INTO tokens (student_id, service_id, token_number, token_code, status) VALUES (?, ?, ?, ?, 'waiting')");
    $ins->execute([$user['id'], $serviceId, $nextNum, $code]);

    echo json_encode(['success' => true, 'token_code' => $code]);
    exit();
}

// 2. Get Student's Token + Position + ETA
if ($action === 'my_token') {
    $user = checkUser('student');

    // Find active token or latest token
    $stmt = $pdo->prepare("
        SELECT t.*, s.name as service_name, s.average_time 
        FROM tokens t 
        JOIN services s ON t.service_id = s.id 
        WHERE t.student_id = ? 
        ORDER BY t.id DESC LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $token = $stmt->fetch();

    if (!$token) {
        echo json_encode(['success' => true, 'has_token' => false]);
        exit();
    }

    $peopleAhead = 0;
    $estimatedWait = 0;

    if ($token['status'] === 'waiting') {
        $aheadStmt = $pdo->prepare("
            SELECT COUNT(*) FROM tokens 
            WHERE service_id = ? AND status = 'waiting' AND id < ?
        ");
        $aheadStmt->execute([$token['service_id'], $token['id']]);
        $peopleAhead = (int)$aheadStmt->fetchColumn();
        $estimatedWait = $peopleAhead * (int)$token['average_time'];
    }

    echo json_encode([
        'success'        => true,
        'has_token'      => true,
        'token'          => $token,
        'people_ahead'   => $peopleAhead,
        'estimated_wait' => $estimatedWait
    ]);
    exit();
}

// -------------------------------------------------------------
// STAFF ACTIONS
// -------------------------------------------------------------

// 3. Get Staff Queue View
if ($action === 'staff_queue') {
    checkUser('staff');
    $serviceId = (int)($_GET['service_id'] ?? 1);

    // Current token being attended (called or processing)
    $curr = $pdo->prepare("
        SELECT t.*, u.name as student_name, s.name as service_name 
        FROM tokens t 
        JOIN users u ON t.student_id = u.id 
        JOIN services s ON t.service_id = s.id 
        WHERE t.service_id = ? AND t.status IN ('called', 'processing') 
        ORDER BY t.id DESC LIMIT 1
    ");
    $curr->execute([$serviceId]);
    $currentToken = $curr->fetch();

    // Waiting queue
    $wait = $pdo->prepare("
        SELECT t.id, t.token_code, u.name as student_name 
        FROM tokens t 
        JOIN users u ON t.student_id = u.id 
        WHERE t.service_id = ? AND t.status = 'waiting' 
        ORDER BY t.id ASC
    ");
    $wait->execute([$serviceId]);
    $waitingQueue = $wait->fetchAll();

    $sName = $pdo->prepare("SELECT name FROM services WHERE id = ?");
    $sName->execute([$serviceId]);
    $serviceName = $sName->fetchColumn() ?: 'Examination Cell';

    echo json_encode([
        'success'       => true,
        'service_name'  => $serviceName,
        'current_token' => $currentToken ?: null,
        'waiting_queue' => $waitingQueue
    ]);
    exit();
}

// 4. Staff Call Next
if ($action === 'call_next') {
    checkUser('staff');
    $serviceId = (int)($input['service_id'] ?? 1);

    // Check if staff already has a token in process
    $chk = $pdo->prepare("SELECT id FROM tokens WHERE service_id = ? AND status IN ('called', 'processing') LIMIT 1");
    $chk->execute([$serviceId]);
    if ($chk->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Please complete the current token before calling next']);
        exit();
    }

    // Oldest waiting token
    $find = $pdo->prepare("SELECT id, token_code FROM tokens WHERE service_id = ? AND status = 'waiting' ORDER BY id ASC LIMIT 1");
    $find->execute([$serviceId]);
    $oldest = $find->fetch();

    if (!$oldest) {
        echo json_encode(['success' => false, 'error' => 'No students are currently waiting']);
        exit();
    }

    $upd = $pdo->prepare("UPDATE tokens SET status = 'called' WHERE id = ?");
    $upd->execute([$oldest['id']]);

    echo json_encode(['success' => true, 'token_code' => $oldest['token_code']]);
    exit();
}

// 5. Staff Start Processing
if ($action === 'start') {
    checkUser('staff');
    $tokenId = (int)($input['token_id'] ?? 0);
    $upd = $pdo->prepare("UPDATE tokens SET status = 'processing' WHERE id = ? AND status = 'called'");
    $upd->execute([$tokenId]);
    echo json_encode(['success' => true]);
    exit();
}

// 6. Staff Complete Token
if ($action === 'complete') {
    checkUser('staff');
    $tokenId = (int)($input['token_id'] ?? 0);
    $upd = $pdo->prepare("UPDATE tokens SET status = 'completed' WHERE id = ? AND status IN ('called', 'processing')");
    $upd->execute([$tokenId]);
    echo json_encode(['success' => true]);
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid action']);
