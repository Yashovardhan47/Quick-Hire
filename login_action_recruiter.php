<?php
require_once __DIR__ . '/db_connect.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /quickhire/recruiter_login.html');
    exit;
}

$email = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';

if ($email === '' || $password === '') {
    header('Location: /quickhire/recruiter_login.html?error=invalid');
    exit;
}

// Look up recruiter by email
$stmt = $conn->prepare('SELECT id, password_hash FROM recruiters WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();
$stmt->close();

if ($user) {
    $stored = $user['password_hash'] ?? '';
    $isBcrypt = is_string($stored) && strpos($stored, '$2y$') === 0 && strlen($stored) >= 60;

    if ($isBcrypt && password_verify($password, $stored)) {
        $_SESSION['recruiter_id'] = $user['id'];
        header('Location: /quickhire/recruiter_dashboard.html');
        exit;
    }

    if (!$isBcrypt && $stored !== '' && $password === $stored) {
        $newHash = password_hash($password, PASSWORD_BCRYPT);
        $upd = $conn->prepare('UPDATE recruiters SET password_hash = ? WHERE id = ?');
        $upd->bind_param('si', $newHash, $user['id']);
        $upd->execute();
        $upd->close();
        $_SESSION['recruiter_id'] = $user['id'];
        header('Location: /quickhire/recruiter_dashboard.html');
        exit;
    }

    $colStmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'recruiters' AND COLUMN_NAME = 'password'");
    $colStmt->bind_param('s', $dbname);
    $colStmt->execute();
    $colRes = $colStmt->get_result();
    $col = $colRes ? $colRes->fetch_assoc() : null;
    $colStmt->close();

    if ($col && (int)$col['cnt'] > 0) {
        $pstmt = $conn->prepare('SELECT password FROM recruiters WHERE id = ?');
        $pstmt->bind_param('i', $user['id']);
        $pstmt->execute();
        $pres = $pstmt->get_result();
        $prow = $pres->fetch_assoc();
        $pstmt->close();

        if ($prow && isset($prow['password']) && $password === (string)$prow['password']) {
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $upd = $conn->prepare('UPDATE recruiters SET password_hash = ? WHERE id = ?');
            $upd->bind_param('si', $newHash, $user['id']);
            $upd->execute();
            $upd->close();
            $_SESSION['recruiter_id'] = $user['id'];
            header('Location: /quickhire/recruiter_dashboard.html');
            exit;
        }
    }
}

// Authentication failed
header('Location: /quickhire/recruiter_login.html?error=1');
exit;

