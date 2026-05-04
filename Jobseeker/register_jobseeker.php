<?php
require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /quickhire/jobseeker_register.html');
    exit;
}

$full_name = trim($_POST['full_name'] ?? '');
$email = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';
$location = trim($_POST['location'] ?? '');
$experience = isset($_POST['experience']) && $_POST['experience'] !== '' ? (int)$_POST['experience'] : null;

if ($full_name === '' || $email === '' || $password === '' || $location === '') {
    header('Location: /quickhire/jobseeker_register.html?error=invalid');
    exit;
}

$stmt = $conn->prepare('SELECT id FROM job_seekers WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    header('Location: /quickhire/jobseeker_register.html?error=exists');
    exit;
}

$password_hash = password_hash($password, PASSWORD_BCRYPT);

$stmt = $conn->prepare('INSERT INTO job_seekers (full_name, email, password_hash, location, experience) VALUES (?, ?, ?, ?, ?)');
// Use i for integer experience, but allow null via binding with type 'i' and passing null
$stmt->bind_param('ssssi', $full_name, $email, $password_hash, $location, $experience);
$stmt->execute();
$stmt->close();

header('Location: /quickhire/jobseeker_login.html?registered=1');
exit;
