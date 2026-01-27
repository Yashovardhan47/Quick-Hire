<?php
$servername = "localhost";
$username = "Quickhire_user";
$password = "Yashu3547";
$dbname = "quick_hire";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);
// Ensure proper charset
$conn->set_charset("utf8mb4");

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
?>
