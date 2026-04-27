<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

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
        'value' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\nginx.exe',
        'source' => 'detected',
        'available' => file_exists('C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\nginx.exe'),
    ],
    [
        'key' => 'php_ini',
        'label' => 'Active PHP config',
        'value' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini',
        'source' => 'detected',
        'available' => file_exists('C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini'),
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
        'value' => 'C:\\Program Files\\nodejs\\node.exe',
        'source' => 'detected',
        'available' => file_exists('C:\\Program Files\\nodejs\\node.exe'),
    ],
];

json_response($items);
