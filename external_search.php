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

    $q = trim((string)($_GET['q'] ?? ''));
    $location = trim((string)($_GET['location'] ?? ''));
    $min_exp = isset($_GET['min_exp']) && $_GET['min_exp'] !== '' ? (int)$_GET['min_exp'] : null;
    $max_exp = isset($_GET['max_exp']) && $_GET['max_exp'] !== '' ? (int)$_GET['max_exp'] : null;
    $skills = trim((string)($_GET['skills'] ?? ''));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $page_size = min(100, max(1, (int)($_GET['page_size'] ?? 20)));
    $sort = (string)($_GET['sort'] ?? 'relevance');

    // Build provider-specific query params for JSearch
    // JSearch uses 'query' as the main free text. We'll compose a query including skills/location if provided.
    $queryParts = [];
    if ($q !== '') $queryParts[] = $q;
    if ($skills !== '') $queryParts[] = $skills;
    if ($location !== '') $queryParts[] = $location;
    $composed = trim(implode(' ', array_filter($queryParts)));
    if ($composed === '' && $q === '') { $composed = $q; }

    $providerParams = [
        'query' => $composed,
        'page' => $page,
        'num_pages' => 1,
        'page_size' => $page_size,
    ];
    // Clean nulls
    $providerParams = array_filter($providerParams, function($v){ return $v !== null && $v !== ''; });

    $url = rtrim(RAPIDAPI_BASE_URL, '/') . RAPIDAPI_SEARCH_PATH . '?' . http_build_query($providerParams);

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

    // Normalize response for JSearch
    $itemsRaw = $raw['items'] ?? $raw['data'] ?? [];
    $total = (int)($raw['total'] ?? $raw['count'] ?? $raw['data_total'] ?? count($itemsRaw));

    $items = [];
    foreach ($itemsRaw as $r) {
        $id = $r['job_id'] ?? $r['id'] ?? ($r['uuid'] ?? null);
        $loc = $r['job_city'] ?? $r['job_state'] ?? $r['job_country'] ?? ($r['location'] ?? ($r['city'] ?? ''));
        $skillsList = $r['job_required_skills'] ?? $r['skills'] ?? [];
        $skillsStr = is_array($skillsList) ? implode(', ', $skillsList) : (string)$skillsList;
        $items[] = [
            'id' => $id,
            'full_name' => $r['job_title'] ?? ($r['title'] ?? ''),
            'email' => $r['job_contact_email'] ?? ($r['email'] ?? ''),
            'location' => $loc,
            'experience' => null, // JSearch is job-focused; experience typically not present
            'skills' => $skillsStr,
        ];
    }

    echo json_encode([
        'ok' => true,
        'page' => $page,
        'page_size' => $page_size,
        'total' => $total,
        'items' => $items
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
