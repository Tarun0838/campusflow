<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

// Smart Journey API - Accessible to authenticated users (Student primary)
$user = checkUser(['student', 'staff', 'admin']);

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $_GET['action'] ?? ($input['action'] ?? 'plan');

// -------------------------------------------------------------
// 1. PLAN SMART JOURNEY
// -------------------------------------------------------------
if ($action === 'plan') {
    $serviceIds = $input['service_ids'] ?? [];

    if (!is_array($serviceIds) || empty($serviceIds)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Please select at least one campus service.'
        ]);
        exit();
    }

    // Clean & deduplicate IDs
    $cleanIds = [];
    foreach ($serviceIds as $sid) {
        $id = (int)$sid;
        if ($id > 0 && !in_array($id, $cleanIds, true)) {
            $cleanIds[] = $id;
        }
    }

    if (empty($cleanIds)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'Invalid service selection.'
        ]);
        exit();
    }

    // Fetch details & live queue counts for the selected services
    $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
    $stmt = $pdo->prepare("
        SELECT s.id, s.name, s.prefix, s.average_time, s.prerequisite_service_id,
               COUNT(CASE WHEN t.status = 'waiting' THEN 1 END) AS waiting_count
        FROM services s
        LEFT JOIN tokens t ON s.id = t.service_id
        WHERE s.id IN ($placeholders) AND s.status = 'active'
        GROUP BY s.id
    ");
    $stmt->execute($cleanIds);
    $selected = $stmt->fetchAll();

    if (empty($selected)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error'   => 'Selected services are currently inactive or unavailable.'
        ]);
        exit();
    }

    // Index by ID for fast lookup
    $serviceMap = [];
    foreach ($selected as $s) {
        $avgTime = max(1, (int)$s['average_time']);
        $waitCount = (int)$s['waiting_count'];
        $estWait = $waitCount * $avgTime;

        $serviceMap[$s['id']] = [
            'id'                      => (int)$s['id'],
            'name'                    => $s['name'],
            'prefix'                  => $s['prefix'],
            'average_time'            => $avgTime,
            'waiting_count'           => $waitCount,
            'estimated_wait'          => $estWait,
            'prerequisite_service_id' => $s['prerequisite_service_id'] ? (int)$s['prerequisite_service_id'] : null
        ];
    }

    // Simple, explainable dependency + shortest-wait-first scheduling:
    // Build directed edges for dependencies that exist within the selected set
    $remaining = array_values($serviceMap);
    $ordered = [];

    // Safety loop guard against circular dependencies
    $iterations = 0;
    $maxIterations = count($remaining) * 2;

    while (!empty($remaining) && $iterations < $maxIterations) {
        $iterations++;

        // Find candidate services that have no unresolved prerequisites in the remaining set
        $candidates = [];
        foreach ($remaining as $item) {
            $hasUnresolvedPrereq = false;
            if ($item['prerequisite_service_id'] !== null) {
                foreach ($remaining as $other) {
                    if ($other['id'] === $item['prerequisite_service_id']) {
                        $hasUnresolvedPrereq = true;
                        break;
                    }
                }
            }
            if (!$hasUnresolvedPrereq) {
                $candidates[] = $item;
            }
        }

        // Fallback: If no candidate due to cycle, take the first remaining
        if (empty($candidates)) {
            $candidates = [$remaining[0]];
        }

        // Among ready candidates, pick the one with shortest estimated wait time
        usort($candidates, function ($a, $b) {
            if ($a['estimated_wait'] === $b['estimated_wait']) {
                return $a['waiting_count'] - $b['waiting_count'];
            }
            return $a['estimated_wait'] - $b['estimated_wait'];
        });

        $chosen = $candidates[0];

        // Determine clear explanation for student
        $reason = '';
        if ($chosen['prerequisite_service_id'] !== null && in_array($chosen['prerequisite_service_id'], $cleanIds, true)) {
            $prereqName = $serviceMap[$chosen['prerequisite_service_id']]['name'] ?? 'Prerequisite service';
            $reason = "Prerequisite completed: Scheduled after $prereqName";
        } elseif (empty($ordered)) {
            if ($chosen['estimated_wait'] === 0) {
                $reason = "Fast-track: Zero waiting line currently";
            } else {
                $reason = "Shortest initial wait time ({$chosen['estimated_wait']} min)";
            }
        } else {
            $reason = "Optimal queue order: {$chosen['waiting_count']} waiting ahead";
        }

        $chosen['recommendation_reason'] = $reason;
        $ordered[] = $chosen;

        // Remove chosen from remaining
        $remaining = array_values(array_filter($remaining, function ($item) use ($chosen) {
            return $item['id'] !== $chosen['id'];
        }));
    }

    // Append any leftover items if loop guard tripped
    foreach ($remaining as $leftover) {
        $leftover['recommendation_reason'] = "Sequential queue clearance";
        $ordered[] = $leftover;
    }

    // Compute totals
    $totalWait = 0;
    $totalServiceTime = 0;
    $stepNumber = 1;

    foreach ($ordered as &$step) {
        $step['step'] = $stepNumber++;
        $totalWait += $step['estimated_wait'];
        $totalServiceTime += $step['average_time'];
    }

    echo json_encode([
        'success'                  => true,
        'selected_count'           => count($ordered),
        'total_estimated_wait'     => $totalWait,
        'total_service_time'       => $totalServiceTime,
        'total_estimated_duration' => $totalWait + $totalServiceTime,
        'journey'                  => $ordered
    ]);
    exit();
}

// -------------------------------------------------------------
// 2. START SMART JOURNEY (Generate token for the 1st step)
// -------------------------------------------------------------
if ($action === 'start') {
    $serviceId = (int)($input['service_id'] ?? 0);

    if ($serviceId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid service for journey initiation.']);
        exit();
    }

    // Check if student already has an active token for this service
    $chk = $pdo->prepare("SELECT id, token_code FROM tokens WHERE student_id = ? AND service_id = ? AND status IN ('waiting', 'called', 'processing') LIMIT 1");
    $chk->execute([$user['id'], $serviceId]);
    $existing = $chk->fetch();

    if ($existing) {
        // Return existing active token so student proceeds directly to tracker
        echo json_encode([
            'success'     => true,
            'token_id'    => (int)$existing['id'],
            'token_code'  => $existing['token_code'],
            'is_existing' => true,
            'message'     => 'Resumed active token for the first service.'
        ]);
        exit();
    }

    // Service validation
    $sStmt = $pdo->prepare("SELECT prefix, name FROM services WHERE id = ? AND status = 'active' LIMIT 1");
    $sStmt->execute([$serviceId]);
    $svc = $sStmt->fetch();

    if (!$svc) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Service is currently unavailable.']);
        exit();
    }

    // Generate token number
    $nStmt = $pdo->prepare("SELECT COALESCE(MAX(token_number), 0) + 1 FROM tokens WHERE service_id = ?");
    $nStmt->execute([$serviceId]);
    $nextNum = (int)$nStmt->fetchColumn();

    $code = $svc['prefix'] . '-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);

    $ins = $pdo->prepare("INSERT INTO tokens (student_id, service_id, token_number, token_code, status) VALUES (?, ?, ?, ?, 'waiting')");
    $ins->execute([$user['id'], $serviceId, $nextNum, $code]);
    $newId = (int)$pdo->lastInsertId();

    echo json_encode([
        'success'      => true,
        'token_id'     => $newId,
        'token_code'   => $code,
        'service_name' => $svc['name'],
        'is_existing'  => false
    ]);
    exit();
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid journey action']);
