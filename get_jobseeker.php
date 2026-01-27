<?php
require_once __DIR__ . '/db_connect.php';
session_start();
header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'method_not_allowed']);
        exit;
    }

    if (!isset($_SESSION['recruiter_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'not_authenticated']);
        exit;
    }

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_id']);
        exit;
    }

    $skills_col_exists = false;
    $colStmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'job_seekers' AND COLUMN_NAME = 'skills'");
    $colStmt->bind_param('s', $dbname);
    $colStmt->execute();
    $colRes = $colStmt->get_result();
    $colRow = $colRes ? $colRes->fetch_assoc() : null;
    $colStmt->close();
    if ($colRow && (int)$colRow['cnt'] > 0) { $skills_col_exists = true; }

    $sql = "SELECT id, full_name, email, location, experience" . ($skills_col_exists ? ", skills" : "") . " FROM job_seekers WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    echo json_encode(['ok' => true, 'item' => $row]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
