<?php
require_once __DIR__ . '/db_connect.php';
session_start();
header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'method_not_allowed']);
        exit;
    }

    if (!isset($_SESSION['recruiter_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'not_authenticated']);
        exit;
    }

    $recruiter_id = (int)$_SESSION['recruiter_id'];

    // Accept either jobseeker_id or jobseeker_email
    $jobseeker_id = isset($_POST['jobseeker_id']) && $_POST['jobseeker_id'] !== '' ? (int)$_POST['jobseeker_id'] : null;
    $jobseeker_email = isset($_POST['jobseeker_email']) ? strtolower(trim($_POST['jobseeker_email'])) : '';

    if ($jobseeker_id === null && $jobseeker_email === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing_jobseeker_identifier']);
        exit;
    }

    // Resolve jobseeker ID if email provided
    if ($jobseeker_id === null) {
        $stmt = $conn->prepare('SELECT id FROM job_seekers WHERE email = ?');
        $stmt->bind_param('s', $jobseeker_email);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'jobseeker_not_found']);
            exit;
        }
        $jobseeker_id = (int)$row['id'];
    }

    // Ensure hires table exists (id, recruiter_id, jobseeker_id, status, created_at)
    $conn->query(
        "CREATE TABLE IF NOT EXISTS hires (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recruiter_id INT NOT NULL,
            jobseeker_id INT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'hired',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_pair (recruiter_id, jobseeker_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
    );

    // Insert or ignore duplicate
    $inserted = false;
    try {
        $stmt = $conn->prepare('INSERT INTO hires (recruiter_id, jobseeker_id, status) VALUES (?, ?, \"hired\")');
        $stmt->bind_param('ii', $recruiter_id, $jobseeker_id);
        $stmt->execute();
        $stmt->close();
        $inserted = true;
    } catch (Throwable $e) {
        // If duplicate, treat as success idempotently
        if (strpos($conn->error, 'Duplicate') !== false || strpos($e->getMessage(), 'Duplicate') !== false) {
            $inserted = false;
        } else {
            throw $e;
        }
    }

    echo json_encode([
        'ok' => true,
        'created' => $inserted,
        'message' => $inserted ? 'Hire recorded successfully.' : 'Already hired previously.'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
