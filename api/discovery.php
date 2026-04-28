<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$nginxVersions = nginx_versions();
$phpVersions = php_versions();
$nodeVersions = node_versions();

$nginxCurrent = get_selected_service_version('nginx');
if (!$nginxCurrent || !in_array($nginxCurrent, $nginxVersions, true)) {
    $nginxCurrent = $nginxVersions[0] ?? '1.29.8';
}

$phpCurrent = get_selected_service_version('php_cgi');
if (!$phpCurrent || !in_array($phpCurrent, $phpVersions, true)) {
    $phpCurrent = in_array('8.4.20', $phpVersions, true) ? '8.4.20' : ($phpVersions[0] ?? '8.4.20');
}

$nodeCurrent = get_selected_service_version('nodejs');
if (!$nodeCurrent || !in_array($nodeCurrent, $nodeVersions, true)) {
    $nodeCurrent = $nodeVersions[0] ?? null;
}

$nginxRoot = nginx_version_path($nginxCurrent) ?? nginx_default_version_path() ?? 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8';
$phpRoot = php_version_path($phpCurrent) ?? php_default_version_path() ?? 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe';
$nodePath = node_version_path($nodeCurrent) ?? command_exists_path('node') ?? 'C:\\Program Files\\nodejs\\node.exe';
$mailpitPath = existing_path('C:\\www\\runtimes\\mailpit\\1.29.7\\mailpit.exe') ?? command_exists_path('mailpit') ?? 'C:\\www\\runtimes\\mailpit\\1.29.7\\mailpit.exe';
$pgwebPath = existing_path('C:\\www\\runtimes\\pgweb\\0.16.2\\pgweb.exe') ?? command_exists_path('pgweb') ?? 'C:\\www\\runtimes\\pgweb\\0.16.2\\pgweb.exe';
$redisPath = existing_path('C:\\www\\runtimes\\redis\\8.6.2\\Redis-8.6.2-Windows-x64-msys2\\redis-server.exe') ?? command_exists_path('redis-server') ?? 'C:\\www\\runtimes\\redis\\8.6.2\\Redis-8.6.2-Windows-x64-msys2\\redis-server.exe';

$items = [
    [
        'key' => 'workspace',
        'label' => 'Workspace',
        'value' => 'C:\\www\\rhinobox',
        'source' => 'derived',
        'available' => is_dir('C:\\www\\rhinobox'),
    ],
    [
        'key' => 'web_root',
        'label' => 'Web root',
        'value' => 'C:\\www',
        'source' => 'detected',
        'available' => is_dir('C:\\www'),
    ],
    [
        'key' => 'nginx_bin',
        'label' => 'Active nginx binary',
        'value' => $nginxRoot . '\\nginx.exe',
        'source' => 'selected',
        'available' => file_exists($nginxRoot . '\\nginx.exe'),
    ],
    [
        'key' => 'php_ini',
        'label' => 'Active PHP config',
        'value' => $phpRoot . '\\php.ini',
        'source' => 'selected',
        'available' => file_exists($phpRoot . '\\php.ini'),
    ],
    [
        'key' => 'mariadb_conf',
        'label' => 'MariaDB config',
        'value' => 'C:\\Program Files\\MariaDB 12.2\\data\\my.ini',
        'source' => 'detected',
        'available' => file_exists('C:\\Program Files\\MariaDB 12.2\\data\\my.ini'),
    ],
    [
        'key' => 'mariadb_data',
        'label' => 'MariaDB data dir',
        'value' => 'C:\\Program Files\\MariaDB 12.2\\data',
        'source' => 'detected',
        'available' => is_dir('C:\\Program Files\\MariaDB 12.2\\data'),
    ],
    [
        'key' => 'postgresql_conf',
        'label' => 'PostgreSQL config',
        'value' => 'C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf',
        'source' => 'detected',
        'available' => file_exists('C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf'),
    ],
    [
        'key' => 'postgresql_hba',
        'label' => 'PostgreSQL access rules',
        'value' => 'C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf',
        'source' => 'detected',
        'available' => file_exists('C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf'),
    ],
    [
        'key' => 'postgresql_data',
        'label' => 'PostgreSQL data dir',
        'value' => 'C:\\Program Files\\PostgreSQL\\17\\data',
        'source' => 'detected',
        'available' => is_dir('C:\\Program Files\\PostgreSQL\\17\\data'),
    ],
    [
        'key' => 'nodejs_path',
        'label' => 'Active Node.js path',
        'value' => $nodePath,
        'source' => 'selected',
        'available' => file_exists($nodePath),
    ],
    [
        'key' => 'mailpit_bin',
        'label' => 'Mailpit binary',
        'value' => $mailpitPath,
        'source' => 'detected',
        'available' => file_exists($mailpitPath),
    ],
    [
        'key' => 'pgweb_bin',
        'label' => 'Pgweb binary',
        'value' => $pgwebPath,
        'source' => 'detected',
        'available' => file_exists($pgwebPath),
    ],
    [
        'key' => 'redis_bin',
        'label' => 'Redis binary',
        'value' => $redisPath,
        'source' => 'detected',
        'available' => file_exists($redisPath),
    ],
    [
        'key' => 'memcached_lite',
        'label' => 'Memcached endpoint',
        'value' => '127.0.0.1:11211',
        'source' => 'embedded',
        'available' => port_listening(11211),
    ],
    [
        'key' => 'vhosts_dir',
        'label' => 'Virtual host configs',
        'value' => 'C:\\www\\rhinobox\\config\\nginx\\vhosts',
        'source' => 'derived',
        'available' => is_dir('C:\\www\\rhinobox\\config\\nginx\\vhosts'),
    ],
];

json_response($items);
