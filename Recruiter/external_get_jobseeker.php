<?php
require_once __DIR__ . '/rapidapi_config.php';
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

    $id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_id']);
        exit;
    }

    // JSearch job details: expects job_id
    $url = rtrim(RAPIDAPI_BASE_URL, '/') . RAPIDAPI_GET_PATH . '?' . http_build_query(['job_id' => $id]);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-RapidAPI-Key: ' . RAPIDAPI_KEY,
        'X-RapidAPI-Host: ' . RAPIDAPI_HOST,
        'Accept: application/json'
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err || $status >= 400) {
        http_response_code(502);
        echo json_encode(['error' => 'upstream_error', 'status' => $status]);
        exit;
    }

    $raw = json_decode($resp, true);
    if (!is_array($raw)) {
        http_response_code(502);
        echo json_encode(['error' => 'invalid_upstream_response']);
        exit;
    }

    // Normalize fields from JSearch job details
    $dataArr = $raw['data'] ?? ($raw['items'] ?? []);
    $r = is_array($dataArr) && count($dataArr) ? $dataArr[0] : $raw;
    $skillsList = $r['job_required_skills'] ?? $r['skills'] ?? [];
    $skillsStr = is_array($skillsList) ? implode(', ', $skillsList) : (string)$skillsList;
    $item = [
        'id' => $r['job_id'] ?? $id,
        'full_name' => $r['job_title'] ?? ($r['title'] ?? ''),
        'email' => $r['job_contact_email'] ?? ($r['email'] ?? ''),
        'location' => ($r['job_city'] ?? $r['job_state'] ?? $r['job_country'] ?? ($r['location'] ?? '')),
        'experience' => null,
        'skills' => $skillsStr,
    ];

    echo json_encode(['ok' => true, 'item' => $item]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
