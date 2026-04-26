<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function tail_lines(string $path, int $maxLines = 80): array
{
    if (!file_exists($path)) {
        return [];
    }

    $lines = @file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($lines)) {
        return [];
    }

    return array_slice($lines, -$maxLines);
}

$targets = [
    [
        'key' => 'nginx_error',
        'label' => 'nginx error.log',
        'path' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\logs\\error.log',
    ],
    [
        'key' => 'vite_dev',
        'label' => 'RhinoBOX vite-dev.log',
        'path' => 'C:\\www\\rhinobox\\vite-dev.log',
    ],
    [
        'key' => 'phpmyadmin_config',
        'label' => 'phpMyAdmin config.inc.php',
        'path' => 'C:\\www\\phpmyadmin\\config.inc.php',
    ],
];

$payload = array_map(static function (array $target): array {
    return [
        'key' => $target['key'],
        'label' => $target['label'],
        'path' => $target['path'],
        'available' => file_exists($target['path']),
        'lines' => tail_lines($target['path']),
    ];
}, $targets);

json_response($payload);
