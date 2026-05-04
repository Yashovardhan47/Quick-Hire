<?php
require_once __DIR__ . '/db_connect.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /quickhire/jobseeker_login.html');
    exit;
}

$email = strtolower(trim($_POST['email'] ?? $_POST['js-email'] ?? ''));
$password = $_POST['password'] ?? '';

if ($email === '' || $password === '') {
    header('Location: /quickhire/jobseeker_login.html?error=invalid');
    exit;
}

$stmt = $conn->prepare('SELECT id, password_hash FROM job_seekers WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$res = $stmt->get_result();
$user = $res->fetch_assoc();
$stmt->close();

if ($user && password_verify($password, $user['password_hash'])) {
    $_SESSION['jobseeker_id'] = $user['id'];
    header('Location: /quickhire/job_seeker_dashboard.html');
    exit;
}

header('Location: /quickhire/jobseeker_login.html?error=1');
exit;
