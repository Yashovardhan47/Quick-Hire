<?php
// Legacy PHP compatibility only. The AI platform uses backend/app/db/session.py.
// Secrets must be provided by the runtime environment and never committed.
$servername = getenv('DB_HOST') ?: 'localhost';
$username = getenv('DB_USER') ?: 'quickhire';
$password = getenv('DB_PASSWORD') ?: '';
$dbname = getenv('DB_NAME') ?: 'quickhire';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn = new mysqli($servername, $username, $password, $dbname);
$conn->set_charset('utf8mb4');
?>

