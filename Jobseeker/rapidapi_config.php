<?php
// Legacy connector configuration. Never place an API key in this file.
$rapidApiKey = getenv('RAPIDAPI_KEY') ?: '';
if ($rapidApiKey === '') {
    http_response_code(503);
    exit('RAPIDAPI_KEY is not configured');
}

define('RAPIDAPI_KEY', $rapidApiKey);
define('RAPIDAPI_HOST', 'jsearch.p.rapidapi.com');
define('RAPIDAPI_BASE_URL', 'https://jsearch.p.rapidapi.com');
define('RAPIDAPI_SEARCH_PATH', '/search');
define('RAPIDAPI_GET_PATH', '/job-details');
?>

