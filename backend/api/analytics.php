<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

// RBAC: Restricted to Admin only
checkUser('admin');

$action = $_GET['action'] ?? 'intelligence';

// Thresholds for Rule-Based Bottleneck Detection (easily configurable)
define('BOTTLENECK_NORMAL_MAX', 5);
define('BOTTLENECK_MODERATE_MAX', 10);

// Minimum tokens needed for statistically valid demand distribution
define('MIN_HISTORICAL_TOKENS', 5);

// -------------------------------------------------------------
// HELPER: Fetch Bottleneck Data
// -------------------------------------------------------------
function getBottleneckData($pdo) {
    $stmt = $pdo->query("
        SELECT s.id, s.name, s.prefix, s.average_time, s.status,
               COUNT(CASE WHEN t.status = 'waiting' THEN 1 END) as waiting_count
        FROM services s
        LEFT JOIN tokens t ON s.id = t.service_id
        WHERE s.status = 'active'
        GROUP BY s.id
        ORDER BY waiting_count DESC, s.name ASC
    ");
    $services = $stmt->fetchAll();

    $bottlenecks = [];
    $highCount = 0;
    $moderateCount = 0;
    $normalCount = 0;

    foreach ($services as $s) {
        $q = (int)$s['waiting_count'];
        $avgTime = max(1, (int)$s['average_time']);
        $estWait = $q * $avgTime;

        if ($q <= BOTTLENECK_NORMAL_MAX) {
            $status = 'NORMAL';
            $level = 'normal';
            $badgeClass = 'badge-completed';
            $normalCount++;
        } elseif ($q <= BOTTLENECK_MODERATE_MAX) {
            $status = 'MODERATE';
            $level = 'moderate';
            $badgeClass = 'badge-waiting';
            $moderateCount++;
        } else {
            $status = 'HIGH CONGESTION';
            $level = 'high';
            $badgeClass = 'badge-waiting'; // styled with high alert styling in CSS
            $highCount++;
        }

        $bottlenecks[] = [
            'service_id'     => (int)$s['id'],
            'service_name'   => $s['name'],
            'prefix'         => $s['prefix'],
            'average_time'   => $avgTime,
            'queue'          => $q,
            'estimated_wait' => $estWait,
            'status'         => $status,
            'level'          => $level,
            'badge_class'    => $badgeClass
        ];
    }

    return [
        'thresholds' => [
            'normal_max'   => BOTTLENECK_NORMAL_MAX,
            'moderate_max' => BOTTLENECK_MODERATE_MAX
        ],
        'counts' => [
            'high'     => $highCount,
            'moderate' => $moderateCount,
            'normal'   => $normalCount
        ],
        'services' => $bottlenecks
    ];
}

// -------------------------------------------------------------
// HELPER: Fetch Campus Demand Prediction (Historical Analysis)
// -------------------------------------------------------------
function getDemandPrediction($pdo) {
    // Check total token records in system
    $totalTokens = (int)$pdo->query("SELECT COUNT(*) FROM tokens")->fetchColumn();

    if ($totalTokens < MIN_HISTORICAL_TOKENS) {
        return [
            'has_sufficient_data' => false,
            'total_analyzed'      => $totalTokens,
            'message'             => 'Not enough historical data for demand prediction (requires at least ' . MIN_HISTORICAL_TOKENS . ' records).'
        ];
    }

    // Hourly aggregation between 08:00 AM (8) and 05:00 PM (17)
    $stmt = $pdo->query("
        SELECT HOUR(created_at) as hr, COUNT(*) as token_count
        FROM tokens
        WHERE HOUR(created_at) BETWEEN 8 AND 17
        GROUP BY HOUR(created_at)
        ORDER BY hr ASC
    ");
    $hourlyRows = $stmt->fetchAll();

    $hourMap = [];
    foreach ($hourlyRows as $row) {
        $hourMap[(int)$row['hr']] = (int)$row['token_count'];
    }

    $hoursData = [];
    $maxCount = 0;
    $peakHour = 12;
    $maxPeak = 0;

    // Standard campus window: 09:00 AM (9) to 04:00 PM (16)
    for ($h = 9; $h <= 16; $h++) {
        $count = $hourMap[$h] ?? 0;
        if ($count > $maxCount) {
            $maxCount = $count;
        }

        $label = ($h < 12) ? sprintf("%02d AM", $h) : (($h === 12) ? "12 PM" : sprintf("%02d PM", $h - 12));
        $hoursData[] = [
            'hour'        => $h,
            'label'       => $label,
            'token_count' => $count
        ];
    }

    // Determine Peak Window (Find highest 2-hour window)
    $bestWindowSum = -1;
    $bestWindowStart = 11;
    for ($h = 9; $h <= 15; $h++) {
        $sum = ($hourMap[$h] ?? 0) + ($hourMap[$h + 1] ?? 0);
        if ($sum > $bestWindowSum) {
            $bestWindowSum = $sum;
            $bestWindowStart = $h;
        }
    }

    $formatHour = function($h) {
        if ($h < 12) return sprintf("%d AM", $h);
        if ($h === 12) return "12 PM";
        return sprintf("%d PM", $h - 12);
    };

    $peakWindow = $bestWindowSum > 0 
        ? ($formatHour($bestWindowStart) . " - " . $formatHour($bestWindowStart + 2))
        : "11 AM - 1 PM";

    // Most demanded service historically
    $svcStmt = $pdo->query("
        SELECT s.name, COUNT(t.id) as total_tokens
        FROM services s
        JOIN tokens t ON s.id = t.service_id
        GROUP BY s.id
        ORDER BY total_tokens DESC
        LIMIT 1
    ");
    $topService = $svcStmt->fetch();
    $mostDemanded = $topService ? $topService['name'] : 'N/A';

    // Add percentage for CSS bar rendering
    foreach ($hoursData as &$hd) {
        $hd['percentage'] = $maxCount > 0 ? round(($hd['token_count'] / $maxCount) * 100) : 0;
        $hd['is_peak'] = ($hd['hour'] >= $bestWindowStart && $hd['hour'] < $bestWindowStart + 2 && $hd['token_count'] > 0);
    }

    return [
        'has_sufficient_data'   => true,
        'total_analyzed'        => $totalTokens,
        'peak_window'           => $peakWindow,
        'most_demanded_service' => $mostDemanded,
        'hourly_distribution'   => $hoursData
    ];
}

// -------------------------------------------------------------
// HELPER: Smart Counter Allocation Recommendation
// -------------------------------------------------------------
function getCounterAllocation($pdo, $bottleneckData) {
    $services = $bottleneckData['services'] ?? [];

    if (empty($services)) {
        return [
            'status'         => 'optimal',
            'suggested'      => false,
            'recommendation' => 'All services are inactive or operating within normal limits.',
            'reason'         => 'No active queues found.'
        ];
    }

    // Sort services by current queue descending
    usort($services, function ($a, $b) {
        return $b['queue'] - $a['queue'];
    });

    $highest = $services[0];
    $lowest = end($services);

    // Congestion threshold for recommending counter reallocation
    if ($highest['queue'] > BOTTLENECK_NORMAL_MAX) {
        $highName = $highest['service_name'];
        $highQueue = $highest['queue'];
        $highEstWait = $highest['estimated_wait'];

        if ($lowest['queue'] <= 2 && $lowest['service_id'] !== $highest['service_id']) {
            $lowName = $lowest['service_name'];
            $lowQueue = $lowest['queue'];

            return [
                'status'              => 'rebalance_suggested',
                'suggested'           => true,
                'target_service'      => $highName,
                'source_service'      => $lowName,
                'high_queue'          => $highQueue,
                'low_queue'           => $lowQueue,
                'action'              => "Consider reassigning an available counter from {$lowName} to {$highName}.",
                'reason'              => "{$highName} currently has {$highQueue} students waiting (~{$highEstWait} min clearance), whereas {$lowName} has only {$lowQueue} in line.",
                'is_action_advisory'  => true
            ];
        } else {
            return [
                'status'              => 'capacity_alert',
                'suggested'           => true,
                'target_service'      => $highName,
                'high_queue'          => $highQueue,
                'action'              => "Consider opening an auxiliary counter for {$highName}.",
                'reason'              => "{$highName} has the highest queue load across the campus ({$highQueue} students waiting, ~{$highEstWait} min clearance).",
                'is_action_advisory'  => true
            ];
        }
    }

    return [
        'status'             => 'optimal',
        'suggested'          => false,
        'action'             => 'Counter allocation is currently balanced.',
        'reason'             => 'All departments are operating within standard queue capacity (≤ ' . BOTTLENECK_NORMAL_MAX . ' students).',
        'is_action_advisory' => true
    ];
}

// -------------------------------------------------------------
// DISPATCH ACTIONS
// -------------------------------------------------------------
if ($action === 'bottlenecks') {
    echo json_encode([
        'success' => true,
        'data'    => getBottleneckData($pdo)
    ]);
    exit();
}

if ($action === 'demand') {
    echo json_encode([
        'success' => true,
        'data'    => getDemandPrediction($pdo)
    ]);
    exit();
}

if ($action === 'counters') {
    $bottlenecks = getBottleneckData($pdo);
    echo json_encode([
        'success' => true,
        'data'    => getCounterAllocation($pdo, $bottlenecks)
    ]);
    exit();
}

// Default: Combined Intelligence Overview
$bottleneckData = getBottleneckData($pdo);
$demandData = getDemandPrediction($pdo);
$counterData = getCounterAllocation($pdo, $bottleneckData);

// Basic stats
$totalToday = (int)$pdo->query("SELECT COUNT(*) FROM tokens WHERE DATE(created_at) = CURDATE()")->fetchColumn();
$waiting = (int)$pdo->query("SELECT COUNT(*) FROM tokens WHERE status = 'waiting'")->fetchColumn();
$completedToday = (int)$pdo->query("SELECT COUNT(*) FROM tokens WHERE status = 'completed' AND DATE(created_at) = CURDATE()")->fetchColumn();
$activeServices = (int)$pdo->query("SELECT COUNT(*) FROM services WHERE status = 'active'")->fetchColumn();

echo json_encode([
    'success' => true,
    'overview' => [
        'total_today'     => $totalToday,
        'waiting'         => $waiting,
        'completed_today' => $completedToday,
        'active_services' => $activeServices
    ],
    'bottlenecks'        => $bottleneckData,
    'demand_prediction' => $demandData,
    'counter_allocation' => $counterData
]);
