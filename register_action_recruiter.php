<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /quickhire/recruiter_register.html');
    exit;
}

$full_name = trim($_POST['full_name'] ?? $_POST['full-name'] ?? '');
$email = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';
$company_name = trim($_POST['company_name'] ?? $_POST['company-name'] ?? '');
$company_website = trim($_POST['company_website'] ?? $_POST['company-website'] ?? '');

if ($full_name === '' || $email === '' || $password === '' || $company_name === '') {
    header('Location: /quickhire/recruiter_register.html?error=invalid');
    exit;
}

$stmt = $conn->prepare('SELECT id FROM recruiters WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    header('Location: /quickhire/recruiter_register.html?error=email_taken');
    exit;
}

$password_hash = password_hash($password, PASSWORD_BCRYPT);

$stmt = $conn->prepare('INSERT INTO recruiters (full_name, email, password_hash, company_name, company_website) VALUES (?, ?, ?, ?, ?)');
$stmt->bind_param('sssss', $full_name, $email, $password_hash, $company_name, $company_website);
$stmt->execute();
$new_recruiter_id = $conn->insert_id;
$stmt->close();

// Redirect to login so credentials can be tested
header('Location: /quickhire/recruiter_login.html?registered=1');
exit;
