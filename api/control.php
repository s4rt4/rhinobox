<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$payload = json_decode(file_get_contents('php://input') ?: '[]', true);
$key = $payload['key'] ?? null;
$action = $payload['action'] ?? null;

if (!is_string($key) || !is_string($action)) {
    json_response(['ok' => false, 'error' => 'Invalid payload'], 400);
}

$commands = [
    'nginx:start' => "& 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'nginx started'",
    'nginx:stop' => "Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force; 'nginx stopped'",
    'nginx:reload' => "& 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'nginx reloaded'",
    'nginx:restart' => "Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force; & 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'nginx restarted'",
    'php_cgi:start' => "& 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'php-cgi started'",
    'php_cgi:stop' => "Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; 'php-cgi stopped'",
    'php_cgi:restart' => "Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 500; & 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'php-cgi restarted'",
    'mariadb:start' => "Start-Service -Name 'MariaDB'; 'MariaDB started'",
    'mariadb:stop' => "Stop-Service -Name 'MariaDB' -Force; 'MariaDB stopped'",
    'mariadb:restart' => "Restart-Service -Name 'MariaDB' -Force; 'MariaDB restarted'",
    'postgresql:start' => "Start-Service -Name 'postgresql-x64-17'; 'PostgreSQL started'",
    'postgresql:stop' => "Stop-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL stopped'",
    'postgresql:restart' => "Restart-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL restarted'",
];

$commandKey = "{$key}:{$action}";

if (!array_key_exists($commandKey, $commands)) {
    json_response(['ok' => false, 'error' => 'Unsupported service action'], 400);
}

$result = run_powershell($commands[$commandKey]);

if ($result['code'] !== 0) {
    json_response(['ok' => false, 'error' => $result['output'] ?: 'Command failed'], 500);
}

json_response(['ok' => true, 'message' => $result['output'] ?: 'Action complete']);
