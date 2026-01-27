<?php
require_once __DIR__ . '/db_connect.php';
session_start();
header('Content-Type: application/json');

function last_name_from_full($full) {
    $full = trim((string)$full);
    if ($full === '') return '';
    $parts = preg_split('/\s+/', $full);
    return count($parts) ? end($parts) : '';
}

try {
    if (isset($_SESSION['recruiter_id'])) {
        $id = (int)$_SESSION['recruiter_id'];
        $stmt = $conn->prepare('SELECT full_name, email FROM recruiters WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        $full = $row['full_name'] ?? '';
        if ($full === '' || $full === null) {
            // fallback: try name column if exists
            $probe = $conn->prepare('SELECT name FROM recruiters WHERE id = ?');
            if ($probe) {
                $probe->bind_param('i', $id);
                $probe->execute();
                $r2 = $probe->get_result();
                $rw2 = $r2 ? $r2->fetch_assoc() : null;
                $probe->close();
                if ($rw2 && !empty($rw2['name'])) $full = $rw2['name'];
            }
        }
        if ($full === '' || $full === null) {
            // fallback to email local-part
            $email = (string)($row['email'] ?? '');
            $local = $email ? explode('@', $email)[0] : '';
            $full = $local;
        }
        echo json_encode([
            'role' => 'recruiter',
            'full_name' => $full,
            'last_name' => last_name_from_full($full),
            'email' => (string)($row['email'] ?? '')
        ]);
        exit;
    }
    if (isset($_SESSION['jobseeker_id'])) {
        $id = (int)$_SESSION['jobseeker_id'];
        $stmt = $conn->prepare('SELECT full_name, email FROM job_seekers WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        $stmt->close();
        $full = $row['full_name'] ?? '';
        if ($full === '' || $full === null) {
            // fallback: try name column if exists
            $probe = $conn->prepare('SELECT name FROM job_seekers WHERE id = ?');
            if ($probe) {
                $probe->bind_param('i', $id);
                $probe->execute();
                $r2 = $probe->get_result();
                $rw2 = $r2 ? $r2->fetch_assoc() : null;
                $probe->close();
                if ($rw2 && !empty($rw2['name'])) $full = $rw2['name'];
            }
        }
        if ($full === '' || $full === null) {
            // fallback to email local-part
            $email = (string)($row['email'] ?? '');
            $local = $email ? explode('@', $email)[0] : '';
            $full = $local;
        }
        echo json_encode([
            'role' => 'jobseeker',
            'full_name' => $full,
            'last_name' => last_name_from_full($full),
            'email' => (string)($row['email'] ?? '')
        ]);
        exit;
    }
    http_response_code(401);
    echo json_encode(['error' => 'not_authenticated']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
