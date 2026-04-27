<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function tasklist_pid(string $imageName): ?int
{
    $result = run_command('tasklist /FI ' . escapeshellarg('IMAGENAME eq ' . $imageName) . ' /FO CSV /NH');
    if ($result['code'] !== 0 || $result['output'] === '' || str_contains($result['output'], 'No tasks are running')) {
        return null;
    }

    $line = strtok($result['output'], "\n");
    if ($line === false) {
        return null;
    }

    $fields = str_getcsv(trim($line), ',', '"', '\\');
    return isset($fields[1]) && is_numeric($fields[1]) ? (int) $fields[1] : null;
}

function service_state(string $name): string
{
    $result = run_command('sc query ' . escapeshellarg($name));
    $output = strtoupper($result['output']);

    if (str_contains($output, 'RUNNING')) {
        return 'running';
    }

    if (str_contains($output, 'STOPPED')) {
        return 'stopped';
    }

    return 'unknown';
}

function listening_ports(): array
{
    $result = run_command('netstat -ano -p tcp');
    $ports = [];

    foreach (preg_split('/\R/', $result['output']) as $line) {
        if (!str_contains($line, 'LISTENING')) {
            continue;
        }

        if (preg_match('/:(\d+)\s+.*LISTENING/i', $line, $matches)) {
            $ports[] = (int) $matches[1];
        }
    }

    return array_values(array_unique($ports));
}

$ports = listening_ports();
$nginxPid = tasklist_pid('nginx.exe');
$phpCgiPid = tasklist_pid('php-cgi.exe');
$postgresPid = tasklist_pid('postgres.exe');

$services = [
    [
        'key' => 'nginx',
        'label' => 'nginx',
        'status' => $nginxPid ? 'running' : 'stopped',
        'detail' => 'Web server for localhost and phpMyAdmin',
        'port' => in_array(80, $ports, true) ? 80 : null,
        'pid' => $nginxPid,
        'canReload' => true,
        'kind' => 'process',
    ],
    [
        'key' => 'php_cgi',
        'label' => 'PHP-CGI',
        'status' => $phpCgiPid ? 'running' : 'stopped',
        'detail' => 'FastCGI bridge for PHP requests',
        'port' => in_array(9000, $ports, true) ? 9000 : null,
        'pid' => $phpCgiPid,
        'canReload' => false,
        'kind' => 'process',
    ],
    [
        'key' => 'mariadb',
        'label' => 'MariaDB',
        'status' => service_state('MariaDB'),
        'detail' => 'Primary local database service',
        'port' => in_array(3306, $ports, true) ? 3306 : null,
        'pid' => null,
        'canReload' => false,
        'kind' => 'windows-service',
        'currentVersion' => '12.2.2',
        'versions' => ['12.2.2'],
    ],
    [
        'key' => 'postgresql',
        'label' => 'PostgreSQL',
        'status' => service_state('postgresql-x64-17'),
        'detail' => 'Primary PostgreSQL database service',
        'port' => in_array(5432, $ports, true) ? 5432 : null,
        'pid' => $postgresPid,
        'canReload' => false,
        'kind' => 'windows-service',
        'currentVersion' => '17.9',
        'versions' => ['17.9'],
    ],
];

json_response($services);
