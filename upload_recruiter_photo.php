<?php
require_once __DIR__ . '/db_connect.php';
session_start();

if (!isset($_SESSION['recruiter_id'])) {
    header('Location: /quickhire/recruiter_login.html');
    exit;
}

$rid = (int)$_SESSION['recruiter_id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['profile_photo'])) {
    header('Location: /quickhire/recruiter_profile.html?error=badrequest');
    exit;
}

$file = $_FILES['profile_photo'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    header('Location: /quickhire/recruiter_profile.html?error=upload');
    exit;
}

// Validate size (max 3MB)
$maxBytes = 3 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
    header('Location: /quickhire/recruiter_profile.html?error=toolarge');
    exit;
}

// Validate type by mime
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    header('Location: /quickhire/recruiter_profile.html?error=type');
    exit;
}

$ext = $allowed[$mime];
$uploadDir = __DIR__ . '/uploads/recruiters';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$basename = 'rec_' . $rid . '_' . time() . '.' . $ext;
$targetPath = $uploadDir . '/' . $basename;
$relativePath = 'uploads/recruiters/' . $basename; // stored in DB

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    header('Location: /quickhire/recruiter_profile.html?error=save');
    exit;
}

// Optionally, delete previous file (if stored and different)
$stmt = $conn->prepare('SELECT profile_photo FROM recruiters WHERE id = ?');
$stmt->bind_param('i', $rid);
$stmt->execute();
$prev = $stmt->get_result()->fetch_assoc();
$stmt->close();

$stmt = $conn->prepare('UPDATE recruiters SET profile_photo = ? WHERE id = ?');
$stmt->bind_param('si', $relativePath, $rid);
$stmt->execute();
$stmt->close();

if ($prev && !empty($prev['profile_photo'])) {
    $oldPath = __DIR__ . '/' . ltrim($prev['profile_photo'], '/');
    if (is_file($oldPath) && $oldPath !== $targetPath) {
        @unlink($oldPath);
    }
}

header('Location: /quickhire/recruiter_profile.html?photo=updated');
exit;
