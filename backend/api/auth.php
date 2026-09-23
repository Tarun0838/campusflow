<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $_GET['action'] ?? ($input['action'] ?? 'login');

// 1. Check Session
if ($action === 'check' || $action === 'me') {
    $authUser = getAuthUser();
    echo json_encode([
        'success' => ($authUser !== null),
        'user'    => $authUser
    ]);
    exit();
}

// 2. Logout
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
    }
    session_destroy();
    echo json_encode(['success' => true]);
    exit();
}

// 3. Register
if ($action === 'register') {
    $fullName = trim($input['full_name'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $confirmPassword = $input['confirm_password'] ?? '';
    $role = trim($input['role'] ?? '');

    if (empty($fullName)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please enter your full name.']);
        exit();
    }

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please enter a valid email address.']);
        exit();
    }

    if (empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please enter a password.']);
        exit();
    }

    if ($password !== $confirmPassword) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Passwords do not match.']);
        exit();
    }

    // Role validation: 'student', 'staff', and 'admin' are allowed
    if ($role !== 'student' && $role !== 'staff' && $role !== 'admin') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please select a valid role.']);
        exit();
    }

    try {
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $chk->execute([$email]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'An account with this email already exists.']);
            exit();
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $ins = $pdo->prepare("INSERT INTO users (full_name, name, email, password, role) VALUES (?, ?, ?, ?, ?)");
        $ins->execute([$fullName, $fullName, $email, $passwordHash, $role]);

        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully. Please login.'
        ]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Something went wrong. Please try again.']);
        exit();
    }
}

// 4. Login
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email or password.']);
    exit();
}

$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user && password_verify($password, $user['password'])) {
    session_regenerate_id(true);

    $displayName = !empty($user['full_name']) ? $user['full_name'] : $user['name'];

    $_SESSION['user_id']   = (int)$user['id'];
    $_SESSION['name']      = $displayName;
    $_SESSION['full_name'] = $displayName;
    $_SESSION['email']     = $user['email'];
    $_SESSION['role']      = $user['role'];

    $_SESSION['user'] = [
        'id'        => (int)$user['id'],
        'name'      => $displayName,
        'full_name' => $displayName,
        'email'     => $user['email'],
        'role'      => $user['role']
    ];

    echo json_encode([
        'success' => true,
        'role'    => $user['role'],
        'name'    => $displayName,
        'email'   => $user['email']
    ]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid email or password.']);
}
