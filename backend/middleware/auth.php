<?php
// Simple Session & Role Middleware
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function checkUser($requiredRole = null) {
    if (!isset($_SESSION['user'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Please login']);
        exit();
    }
    if ($requiredRole && $_SESSION['user']['role'] !== $requiredRole && $_SESSION['user']['role'] !== 'admin') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit();
    }
    return $_SESSION['user'];
}
