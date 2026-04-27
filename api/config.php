<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$configFiles = [
    'nginx' => [
        'key' => 'nginx',
        'label' => 'nginx.conf',
        'path' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf',
        'serviceKey' => 'nginx',
    ],
    'php' => [
        'key' => 'php',
        'label' => 'php.ini',
        'path' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini',
        'serviceKey' => 'php_cgi',
    ],
    'mariadb' => [
        'key' => 'mariadb',
        'label' => 'my.ini',
        'path' => 'C:\\Program Files\\MariaDB 12.2\\data\\my.ini',
        'serviceKey' => 'mariadb',
    ],
    'phpmyadmin' => [
        'key' => 'phpmyadmin',
        'label' => 'config.inc.php',
        'path' => 'C:\\www\\phpmyadmin\\config.inc.php',
        'serviceKey' => null,
    ],
    'postgresql' => [
        'key' => 'postgresql',
        'label' => 'postgresql.conf',
        'path' => 'C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf',
        'serviceKey' => 'postgresql',
    ],
    'postgresql_hba' => [
        'key' => 'postgresql_hba',
        'label' => 'pg_hba.conf',
        'path' => 'C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf',
        'serviceKey' => 'postgresql',
    ],
];

$configFiles = array_map(static function (array $item): array {
    $item['exists'] = file_exists($item['path']);
    return $item;
}, $configFiles);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $key = $_GET['key'] ?? null;

    if (!is_string($key) || $key === '') {
        json_response(array_values($configFiles));
    }

    if (!array_key_exists($key, $configFiles)) {
        json_response(['error' => 'Unknown config key'], 404);
    }

    $item = $configFiles[$key];
    $content = file_exists($item['path']) ? file_get_contents($item['path']) : false;

    if ($content === false) {
        json_response(['error' => 'Unable to read config file'], 500);
    }

    $item['content'] = $content;
    json_response($item);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '[]', true);
    $key = $payload['key'] ?? null;
    $content = $payload['content'] ?? null;

    if (!is_string($key) || !is_string($content) || !array_key_exists($key, $configFiles)) {
        json_response(['ok' => false, 'error' => 'Invalid payload'], 400);
    }

    $path = $configFiles[$key]['path'];
    $backup = $path . '.' . date('Ymd-His') . '.bak';
    if (file_exists($path)) {
        copy($path, $backup);
    }

    $saved = file_put_contents($path, $content);
    if ($saved === false) {
        json_response(['ok' => false, 'error' => 'Failed to save config'], 500);
    }

    if (($payload['reloadService'] ?? false) === true && isset($configFiles[$key]['serviceKey'])) {
        $serviceKey = $configFiles[$key]['serviceKey'];
        $reloadCommands = [
            'nginx' => "& 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'nginx reloaded'",
            'php_cgi' => "Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 500; & 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'php-cgi restarted'",
            'mariadb' => "Restart-Service -Name 'MariaDB' -Force; 'MariaDB restarted'",
            'postgresql' => "Restart-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL restarted'",
        ];

        if (isset($reloadCommands[$serviceKey])) {
            run_powershell($reloadCommands[$serviceKey]);
        }
    }

    json_response(['ok' => true, 'message' => 'Config saved with backup']);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
