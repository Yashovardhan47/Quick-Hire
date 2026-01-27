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

    $q = trim((string)($_GET['q'] ?? ''));
    $location = trim((string)($_GET['location'] ?? ''));
    $min_exp = isset($_GET['min_exp']) && $_GET['min_exp'] !== '' ? (int)$_GET['min_exp'] : null;
    $max_exp = isset($_GET['max_exp']) && $_GET['max_exp'] !== '' ? (int)$_GET['max_exp'] : null;
    $skills = trim((string)($_GET['skills'] ?? ''));
    $page = max(1, (int)($_GET['page'] ?? 1));
    $page_size = (int)($_GET['page_size'] ?? 20);
    if ($page_size < 1) $page_size = 20;
    if ($page_size > 100) $page_size = 100;
    $offset = ($page - 1) * $page_size;
    $sort = (string)($_GET['sort'] ?? 'relevance'); // relevance|name|experience_desc|experience_asc

    // Check if skills column exists
    $skills_col_exists = false;
    $colStmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'job_seekers' AND COLUMN_NAME = 'skills'");
    $colStmt->bind_param('s', $dbname);
    $colStmt->execute();
    $colRes = $colStmt->get_result();
    $colRow = $colRes ? $colRes->fetch_assoc() : null;
    $colStmt->close();
    if ($colRow && (int)$colRow['cnt'] > 0) { $skills_col_exists = true; }

    $where = [];
    $params = [];
    $types = '';

    if ($q !== '') {
        $like = '%' . $q . '%';
        $where[] = '(full_name LIKE ? OR location LIKE ?' . ($skills_col_exists ? ' OR skills LIKE ?' : '') . ')';
        $types .= 'ss' . ($skills_col_exists ? 's' : '');
        $params[] = $like; $params[] = $like; if ($skills_col_exists) $params[] = $like;
    }
    if ($location !== '') {
        $where[] = 'location LIKE ?';
        $types .= 's';
        $params[] = '%' . $location . '%';
    }
    if ($min_exp !== null) {
        $where[] = 'experience >= ?';
        $types .= 'i';
        $params[] = $min_exp;
    }
    if ($max_exp !== null) {
        $where[] = 'experience <= ?';
        $types .= 'i';
        $params[] = $max_exp;
    }
    if ($skills !== '' && $skills_col_exists) {
        $skillParts = array_filter(array_map('trim', explode(',', $skills)));
        if (count($skillParts)) {
            $skillClauses = [];
            foreach ($skillParts as $sk) {
                $skillClauses[] = 'skills LIKE ?';
                $types .= 's';
                $params[] = '%' . $sk . '%';
            }
            $where[] = '(' . implode(' OR ', $skillClauses) . ')';
        }
    }

    $whereSql = count($where) ? ('WHERE ' . implode(' AND ', $where)) : '';

    $orderBy = '';
    if ($sort === 'name') $orderBy = 'ORDER BY full_name ASC';
    else if ($sort === 'experience_desc') $orderBy = 'ORDER BY experience DESC, full_name ASC';
    else if ($sort === 'experience_asc') $orderBy = 'ORDER BY experience ASC, full_name ASC';
    else $orderBy = 'ORDER BY id DESC';

    // Count total
    $countSql = "SELECT COUNT(*) AS total FROM job_seekers $whereSql";
    $countStmt = $conn->prepare($countSql);
    if ($types !== '') { $countStmt->bind_param($types, ...$params); }
    $countStmt->execute();
    $countRes = $countStmt->get_result();
    $total = ($row = $countRes->fetch_assoc()) ? (int)$row['total'] : 0;
    $countStmt->close();

    // Query page
    $sql = "SELECT id, full_name, email, location, experience" . ($skills_col_exists ? ", skills" : "") . " FROM job_seekers $whereSql $orderBy LIMIT ? OFFSET ?";
    $listStmt = $conn->prepare($sql);
    $types2 = $types . 'ii';
    $params2 = $params;
    $params2[] = $page_size; $params2[] = $offset;
    $listStmt->bind_param($types2, ...$params2);
    $listStmt->execute();
    $res = $listStmt->get_result();
    $items = [];
    while ($r = $res->fetch_assoc()) { $items[] = $r; }
    $listStmt->close();

    // Facets: locations and experience buckets
    $facet_locations = [];
    $locSql = "SELECT location, COUNT(*) c FROM job_seekers GROUP BY location ORDER BY c DESC LIMIT 50";
    $locRes = $conn->query($locSql);
    if ($locRes) { while ($lr = $locRes->fetch_assoc()) { $facet_locations[] = $lr; } }

    $facet_experience = [
        ['label' => '0-2', 'min' => 0, 'max' => 2],
        ['label' => '3-5', 'min' => 3, 'max' => 5],
        ['label' => '6-8', 'min' => 6, 'max' => 8],
        ['label' => '9+', 'min' => 9, 'max' => null],
    ];
    foreach ($facet_experience as &$fx) {
        if ($fx['max'] === null) {
            $stmt = $conn->prepare('SELECT COUNT(*) c FROM job_seekers WHERE experience >= ?');
            $stmt->bind_param('i', $fx['min']);
        } else {
            $stmt = $conn->prepare('SELECT COUNT(*) c FROM job_seekers WHERE experience >= ? AND experience <= ?');
            $stmt->bind_param('ii', $fx['min'], $fx['max']);
        }
        $stmt->execute();
        $r = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $fx['count'] = (int)($r['c'] ?? 0);
    }

    echo json_encode([
        'ok' => true,
        'page' => $page,
        'page_size' => $page_size,
        'total' => $total,
        'items' => $items,
        'facets' => [
            'locations' => $facet_locations,
            'experience' => $facet_experience,
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
