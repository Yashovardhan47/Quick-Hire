<?php
require_once __DIR__ . '/db_connect.php';
session_start();

if (!isset($_SESSION['jobseeker_id'])) {
    header('Location: /quickhire/jobseeker_login.html');
    exit;
}

$jid = (int)$_SESSION['jobseeker_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['profile_photo'])) {
    header('Location: /quickhire/jobseeker_profile.html?error=badrequest');
    exit;
}

$file = $_FILES['profile_photo'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    header('Location: /quickhire/jobseeker_profile.html?error=upload');
    exit;
}

$maxBytes = 3 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
    header('Location: /quickhire/jobseeker_profile.html?error=toolarge');
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    header('Location: /quickhire/jobseeker_profile.html?error=type');
    exit;
}

$ext = $allowed[$mime];
$uploadDir = __DIR__ . '/uploads/jobseekers';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$basename = 'js_' . $jid . '_' . time() . '.' . $ext;
$targetPath = $uploadDir . '/' . $basename;
$relativePath = 'uploads/jobseekers/' . $basename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    header('Location: /quickhire/jobseeker_profile.html?error=save');
    exit;
}

$stmt = $conn->prepare('SELECT profile_photo FROM job_seekers WHERE id = ?');
$stmt->bind_param('i', $jid);
$stmt->execute();
$prev = $stmt->get_result()->fetch_assoc();
$stmt->close();

$stmt = $conn->prepare('UPDATE job_seekers SET profile_photo = ? WHERE id = ?');
$stmt->bind_param('si', $relativePath, $jid);
$stmt->execute();
$stmt->close();

if ($prev && !empty($prev['profile_photo'])) {
    $oldPath = __DIR__ . '/' . ltrim($prev['profile_photo'], '/');
    if (is_file($oldPath) && $oldPath !== $targetPath) {
        @unlink($oldPath);
    }
}

header('Location: /quickhire/jobseeker_profile.html?photo=updated');
exit;
