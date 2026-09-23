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

    // Only block if student already has a WAITING, CALLED, or PROCESSING token for this service
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

    // Next token number for this service
    $nStmt = $pdo->prepare("SELECT COALESCE(MAX(token_number), 0) + 1 FROM tokens WHERE service_id = ?");
    $nStmt->execute([$serviceId]);
    $nextNum = (int)$nStmt->fetchColumn();

    $code = $prefix . '-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);

    // Insert new token
    $ins = $pdo->prepare("INSERT INTO tokens (student_id, service_id, token_number, token_code, status) VALUES (?, ?, ?, ?, 'waiting')");
    $ins->execute([$user['id'], $serviceId, $nextNum, $code]);
    $newId = (int)$pdo->lastInsertId();

    echo json_encode(['success' => true, 'token_id' => $newId, 'token_code' => $code]);
    exit();
}

// 2. Get Student's Token + Position + ETA
if ($action === 'my_token') {
    $user = checkUser('student');
    $tokenId = (int)($_GET['id'] ?? ($_GET['token_id'] ?? 0));

    if ($tokenId > 0) {
        $stmt = $pdo->prepare("
            SELECT t.*, s.name as service_name, s.average_time 
            FROM tokens t 
            JOIN services s ON t.service_id = s.id 
            WHERE t.id = ? AND t.student_id = ? 
            LIMIT 1
        ");
        $stmt->execute([$tokenId, $user['id']]);
        $token = $stmt->fetch();
    } else {
        // Priority 1: active token (waiting, called, processing), latest first
        // Priority 2: most recent token (e.g. completed)
        $stmt = $pdo->prepare("
            SELECT t.*, s.name as service_name, s.average_time 
            FROM tokens t 
            JOIN services s ON t.service_id = s.id 
            WHERE t.student_id = ? 
            ORDER BY CASE WHEN t.status IN ('waiting', 'called', 'processing') THEN 0 ELSE 1 END, t.id DESC 
            LIMIT 1
        ");
        $stmt->execute([$user['id']]);
        $token = $stmt->fetch();
    }

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

    // Also get all active tokens for this student across all services
    $activeStmt = $pdo->prepare("
        SELECT t.*, s.name as service_name, s.average_time 
        FROM tokens t 
        JOIN services s ON t.service_id = s.id 
        WHERE t.student_id = ? AND t.status IN ('waiting', 'called', 'processing')
        ORDER BY t.id DESC
    ");
    $activeStmt->execute([$user['id']]);
    $activeTokens = $activeStmt->fetchAll();

    foreach ($activeTokens as &$at) {
        $at['people_ahead'] = 0;
        $at['estimated_wait'] = 0;
        if ($at['status'] === 'waiting') {
            $aheadStmt = $pdo->prepare("
                SELECT COUNT(*) FROM tokens 
                WHERE service_id = ? AND status = 'waiting' AND id < ?
            ");
            $aheadStmt->execute([$at['service_id'], $at['id']]);
            $ahead = (int)$aheadStmt->fetchColumn();
            $at['people_ahead'] = $ahead;
            $at['estimated_wait'] = $ahead * (int)$at['average_time'];
        }
    }

    echo json_encode([
        'success'        => true,
        'has_token'      => true,
        'token'          => $token,
        'active_tokens'  => $activeTokens,
        'people_ahead'   => $peopleAhead,
        'estimated_wait' => $estimatedWait
    ]);
    exit();
}

// -------------------------------------------------------------
// STAFF ACTIONS (Manages ALL active services for this MVP)
// -------------------------------------------------------------

// 3. Get Staff Queue View (Unified queue for all services)
if ($action === 'staff_queue') {
    checkUser('staff');

    // Current token being attended (called or processing) across ALL services
    $curr = $pdo->query("
        SELECT t.*, u.name as student_name, s.name as service_name 
        FROM tokens t 
        JOIN users u ON t.student_id = u.id 
        JOIN services s ON t.service_id = s.id 
        WHERE t.status IN ('called', 'processing') 
        ORDER BY t.id DESC LIMIT 1
    ");
    $currentToken = $curr->fetch();

    // Waiting queue across ALL active services (FIFO: oldest first)
    $wait = $pdo->query("
        SELECT t.id, t.token_code, u.name as student_name, s.name as service_name, t.created_at 
        FROM tokens t 
        JOIN users u ON t.student_id = u.id 
        JOIN services s ON t.service_id = s.id 
        WHERE t.status = 'waiting' 
        ORDER BY t.id ASC
    ");
    $waitingQueue = $wait->fetchAll();

    echo json_encode([
        'success'       => true,
        'service_name'  => 'All Active Services',
        'current_token' => $currentToken ?: null,
        'waiting_queue' => $waitingQueue
    ]);
    exit();
}

// 4. Staff Call Next Token (Selects oldest waiting across ALL active services)
if ($action === 'call_next') {
    checkUser('staff');

    // Check if staff already has a token in called or processing
    $chk = $pdo->query("SELECT id FROM tokens WHERE status IN ('called', 'processing') LIMIT 1");
    if ($chk->fetch()) {
        echo json_encode(['success' => false, 'error' => 'Please complete the current token before calling next']);
        exit();
    }

    // Oldest waiting token across all active services
    $find = $pdo->query("SELECT id, token_code FROM tokens WHERE status = 'waiting' ORDER BY id ASC LIMIT 1");
    $oldest = $find->fetch();

    if (!$oldest) {
        echo json_encode(['success' => false, 'error' => 'No students are currently waiting']);
        exit();
    }

    $upd = $pdo->prepare("UPDATE tokens SET status = 'called' WHERE id = ?");
    $upd->execute([$oldest['id']]);

    echo json_encode(['success' => true, 'token_id' => (int)$oldest['id'], 'token_code' => $oldest['token_code']]);
    exit();
}

// 5. Staff Start Processing (CALLED -> PROCESSING)
if ($action === 'start') {
    checkUser('staff');
    $tokenId = (int)($input['token_id'] ?? 0);
    if ($tokenId > 0) {
        $upd = $pdo->prepare("UPDATE tokens SET status = 'processing' WHERE id = ? AND status = 'called'");
        $upd->execute([$tokenId]);
    } else {
        $upd = $pdo->query("UPDATE tokens SET status = 'processing' WHERE status = 'called' ORDER BY id DESC LIMIT 1");
    }
    echo json_encode(['success' => true]);
    exit();
}

// 6. Staff Complete Token (PROCESSING -> COMPLETED)
if ($action === 'complete') {
    checkUser('staff');
    $tokenId = (int)($input['token_id'] ?? 0);
    if ($tokenId > 0) {
        $upd = $pdo->prepare("UPDATE tokens SET status = 'completed' WHERE id = ? AND status IN ('called', 'processing')");
        $upd->execute([$tokenId]);
    } else {
        $upd = $pdo->query("UPDATE tokens SET status = 'completed' WHERE status IN ('called', 'processing') ORDER BY id DESC LIMIT 1");
    }
    echo json_encode(['success' => true]);
    exit();
}

// -------------------------------------------------------------
// ADMIN ACTIONS
// -------------------------------------------------------------

// 7. Admin View Tokens List (Waiting or Completed)
if ($action === 'admin_tokens') {
    checkUser('admin');
    $type = $_GET['type'] ?? ($input['type'] ?? 'waiting');

    if ($type === 'completed') {
        $stmt = $pdo->query("
            SELECT t.id, t.token_code, u.name as student_name, s.name as service_name, t.status,
                   DATE_FORMAT(t.created_at, '%h:%i %p') as created_time
            FROM tokens t
            JOIN users u ON t.student_id = u.id
            JOIN services s ON t.service_id = s.id
            WHERE t.status = 'completed' AND DATE(t.created_at) = CURDATE()
            ORDER BY t.id DESC
        ");
    } else {
        $stmt = $pdo->query("
            SELECT t.id, t.token_code, u.name as student_name, s.name as service_name, t.status,
                   DATE_FORMAT(t.created_at, '%h:%i %p') as created_time
            FROM tokens t
            JOIN users u ON t.student_id = u.id
            JOIN services s ON t.service_id = s.id
            WHERE t.status = 'waiting'
            ORDER BY t.id ASC
        ");
    }
    $tokens = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'type'    => $type,
        'tokens'  => $tokens
    ]);
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid action']);

