<?php
require_once __DIR__ . '/db_connect.php';
session_start();

if (!isset($_SESSION['jobseeker_id'])) {
    http_response_code(403);
    exit('Not authorized');
}

$jid = (int)$_SESSION['jobseeker_id'];
$stmt = $conn->prepare('SELECT profile_photo FROM job_seekers WHERE id = ?');
$stmt->bind_param('i', $jid);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();
$stmt->close();

$path = null;
if ($row && !empty($row['profile_photo'])) {
    $path = __DIR__ . '/' . ltrim($row['profile_photo'], '/');
}

if ($path && is_file($path)) {
    $mime = mime_content_type($path);
    if (strpos($mime, 'image/') !== 0) {
        $mime = 'image/jpeg';
    }
    header('Content-Type: ' . $mime);
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($path);
    exit;
}

$default = __DIR__ . '/default_avatar.png';
if (is_file($default)) {
    header('Content-Type: image/png');
    readfile($default);
} else {
    http_response_code(404);
}
