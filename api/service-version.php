<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$payload = json_decode(file_get_contents('php://input') ?: '[]', true);
$key = $payload['key'] ?? null;
$version = $payload['version'] ?? null;

if (!is_string($key) || !is_string($version) || $version === '') {
    json_response(['ok' => false, 'error' => 'Invalid payload'], 400);
}

$available = match ($key) {
    'nginx' => nginx_versions(),
    'php_cgi' => php_versions(),
    'nodejs' => node_versions(),
    'mariadb' => ['12.2.2'],
    'postgresql' => ['17.9'],
    'mailpit' => ['1.29.7'],
    'pgweb' => ['0.16.2'],
    'redis' => ['8.6.2'],
    'memcached' => ['lite'],
    default => null,
};

if (!is_array($available)) {
    json_response(['ok' => false, 'error' => 'Unsupported service key'], 400);
}

if (!in_array($version, $available, true)) {
    json_response(['ok' => false, 'error' => 'Version is not installed'], 400);
}

if (!set_selected_service_version($key, $version)) {
    json_response(['ok' => false, 'error' => 'Failed to persist version selection'], 500);
}

json_response([
    'ok' => true,
    'message' => "{$key} version set to {$version}",
]);
