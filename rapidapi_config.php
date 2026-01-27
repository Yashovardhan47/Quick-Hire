<?php
// DO NOT expose your key in any client-side code.
// Configured for JSearch on RapidAPI

define('RAPIDAPI_KEY', 'd0dc68c726mshcd21597f413127fp1bc843jsna571eed6741c');
define('RAPIDAPI_HOST', 'jsearch.p.rapidapi.com');
define('RAPIDAPI_BASE_URL', 'https://jsearch.p.rapidapi.com');
define('RAPIDAPI_SEARCH_PATH', '/search');
// JSearch does not provide a dedicated profile-by-id endpoint; keep same path for any fallback usage
define('RAPIDAPI_GET_PATH', '/job-details');
