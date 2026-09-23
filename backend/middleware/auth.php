<?php
// CampusFlow Session & RBAC Auth Middleware

if (session_status() === PHP_SESSION_NONE) {
    // Secure cookie parameters
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', '', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on', true);
    }
    session_start();
}

// Send HTTP headers to prevent caching of auth-sensitive API responses
if (!headers_sent()) {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

/**
 * Determine if current request expects a JSON API response.
 */
function isApiRequest() {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return (strpos($uri, '/backend/api/') !== false) || (strpos($accept, 'application/json') !== false);
}

/**
 * Helper to get current authenticated user data.
 */
function getAuthUser() {
    if (isset($_SESSION['user_id'])) {
        return [
            'id'        => (int)$_SESSION['user_id'],
            'name'      => $_SESSION['name'] ?? ($_SESSION['user']['name'] ?? ''),
            'full_name' => $_SESSION['full_name'] ?? ($_SESSION['name'] ?? ($_SESSION['user']['full_name'] ?? '')),
            'email'     => $_SESSION['email'] ?? ($_SESSION['user']['email'] ?? ''),
            'role'      => $_SESSION['role'] ?? ($_SESSION['user']['role'] ?? '')
        ];
    }
    if (isset($_SESSION['user'])) {
        return [
            'id'        => (int)$_SESSION['user']['id'],
            'name'      => $_SESSION['user']['name'] ?? '',
            'full_name' => $_SESSION['user']['full_name'] ?? ($_SESSION['user']['name'] ?? ''),
            'email'     => $_SESSION['user']['email'] ?? '',
            'role'      => $_SESSION['user']['role'] ?? ''
        ];
    }
    return null;
}

/**
 * Guard function to require a logged-in user.
 * Redirects to login page (or returns 401 JSON for APIs).
 */
function requireLogin() {
    $user = getAuthUser();
    if (!$user) {
        if (isApiRequest()) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Please login']);
            exit();
        }
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $isSub = (strpos($script, '/student/') !== false || strpos($script, '/staff/') !== false || strpos($script, '/admin/') !== false);
        $redirectUrl = $isSub ? '../login.html' : 'login.html';
        header("Location: $redirectUrl");
        exit();
    }
    return $user;
}

/**
 * Alias for requireLogin()
 */
function requireAuth() {
    return requireLogin();
}

/**
 * Helper to check whether user has the required role (string or array of allowed roles).
 */
function userHasRole($user, $requiredRole) {
    if (empty($requiredRole)) {
        return true;
    }
    if (is_array($requiredRole)) {
        return in_array($user['role'], $requiredRole, true);
    }
    return $user['role'] === $requiredRole;
}

/**
 * Guard function to require a specific role ('student', 'staff', 'admin' or array).
 * Redirects unauthorized users to their assigned dashboard (or returns 403 JSON for APIs).
 */
function requireRole($requiredRole) {
    $user = requireLogin();
    if (!userHasRole($user, $requiredRole)) {
        if (isApiRequest()) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Access denied']);
            exit();
        }
        // Redirect to user's authorized role dashboard
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $isSub = (strpos($script, '/student/') !== false || strpos($script, '/staff/') !== false || strpos($script, '/admin/') !== false);
        $prefix = $isSub ? '../' : '';
        if ($user['role'] === 'admin') {
            header("Location: " . $prefix . "admin/dashboard.html");
        } elseif ($user['role'] === 'staff') {
            header("Location: " . $prefix . "staff/dashboard.html");
        } else {
            header("Location: " . $prefix . "student/dashboard.html");
        }
        exit();
    }
    return $user;
}

/**
 * API helper function to enforce authentication and authorization.
 * Returns 401 if unauthenticated, 403 if unauthorized.
 */
function checkUser($requiredRole = null) {
    $user = getAuthUser();
    if (!$user) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Please login']);
        exit();
    }
    if ($requiredRole && !userHasRole($user, $requiredRole)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit();
    }
    return $user;
}

