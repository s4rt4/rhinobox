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
        'key' => 'nginx_conf',
        'label' => 'nginx.conf',
        'value' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf',
        'source' => 'detected',
        'available' => file_exists('C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf'),
    ],
    [
        'key' => 'php_ini',
        'label' => 'php.ini',
        'value' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini',
        'source' => 'detected',
        'available' => file_exists('C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini'),
    ],
    [
        'key' => 'phpmyadmin',
        'label' => 'phpMyAdmin',
        'value' => 'C:\\www\\phpmyadmin',
        'source' => 'detected',
        'available' => is_dir('C:\\www\\phpmyadmin'),
    ],
    [
        'key' => 'mariadb_service',
        'label' => 'MariaDB service',
        'value' => 'MariaDB',
        'source' => 'detected',
        'available' => true,
    ],
];

json_response($items);
