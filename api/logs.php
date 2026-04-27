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

function latest_matching_file(string $dir, string $prefix, string $suffix): ?string
{
    if (!is_dir($dir)) {
        return null;
    }

    $latestPath = null;
    $latestTime = 0;

    foreach (scandir($dir) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }

        if (!str_starts_with($name, $prefix) || !str_ends_with($name, $suffix)) {
            continue;
        }

        $fullPath = $dir . DIRECTORY_SEPARATOR . $name;
        if (!is_file($fullPath)) {
            continue;
        }

        $mtime = filemtime($fullPath) ?: 0;
        if ($mtime >= $latestTime) {
            $latestTime = $mtime;
            $latestPath = $fullPath;
        }
    }

    return $latestPath;
}

$postgresLog = latest_matching_file(
    'C:\\Program Files\\PostgreSQL\\17\\data\\log',
    'postgresql-',
    '.log'
) ?? 'C:\\Program Files\\PostgreSQL\\17\\data\\log';

$targets = [
    [
        'key' => 'nginx_error',
        'label' => 'nginx error.log',
        'path' => 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\logs\\error.log',
    ],
    [
        'key' => 'mariadb_error',
        'label' => 'MariaDB error log',
        'path' => 'C:\\Program Files\\MariaDB 12.2\\data\\DESKTOP-SAN5L98.err',
    ],
    [
        'key' => 'postgresql_log',
        'label' => 'PostgreSQL log',
        'path' => $postgresLog,
    ],
];

$payload = array_map(static function (array $target): array {
    return [
        'key' => $target['key'],
        'label' => $target['label'],
        'path' => $target['path'],
        'available' => file_exists($target['path']),
        'lines' => tail_lines($target['path'], 120),
    ];
}, $targets);

json_response($payload);
