<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function tasklist_map(): array
{
    $result = run_command('tasklist /FO CSV /NH');
    if ($result['code'] !== 0 || $result['output'] === '') {
        return [];
    }

    $map = [];
    foreach (preg_split('/\R/', $result['output']) as $line) {
        $fields = str_getcsv(trim($line), ',', '"', '\\');
        if (!isset($fields[0], $fields[1]) || !is_numeric($fields[1])) {
            continue;
        }

        $map[strtolower($fields[0])] = (int) $fields[1];
    }

    return $map;
}

function listening_ports(): array
{
    $result = run_command('netstat -ano -p tcp');
    if ($result['code'] !== 0 || $result['output'] === '') {
        return [];
    }

    $ports = [];
    foreach (preg_split('/\R/', $result['output']) as $line) {
        if (!str_contains(strtoupper($line), 'LISTENING')) {
            continue;
        }

        if (preg_match('/:(\d+)\s+.*LISTENING/i', $line, $matches)) {
            $ports[] = (int) $matches[1];
        }
    }

    return array_values(array_unique($ports));
}

function installed_status(?string $path): string
{
    return $path ? 'running' : 'stopped';
}

function current_php_version(array $versions): ?string
{
    $selected = get_selected_service_version('php_cgi');
    if ($selected && in_array($selected, $versions, true)) {
        return $selected;
    }

    if (in_array('8.4.20', $versions, true)) {
        return '8.4.20';
    }

    return $versions[0] ?? null;
}

$ports = listening_ports();
$processes = tasklist_map();

$nginxVersions = nginx_versions();
$phpVersions = php_versions();
$nodeVersions = node_versions();

$nginxCurrent = get_selected_service_version('nginx');
if (!$nginxCurrent || !in_array($nginxCurrent, $nginxVersions, true)) {
    $nginxCurrent = $nginxVersions[0] ?? null;
}

$phpCurrent = current_php_version($phpVersions);

$nodeCurrent = get_selected_service_version('nodejs');
if (!$nodeCurrent || !in_array($nodeCurrent, $nodeVersions, true)) {
    $nodeCurrent = $nodeVersions[0] ?? null;
}

$nodePath = node_version_path($nodeCurrent) ?? command_exists_path('node');
$pythonPath = command_exists_path('python');
$goPath = command_exists_path('go');
$gitPath = command_exists_path('git') ?? existing_path('C:\\Program Files\\Git\\cmd\\git.exe');
$mailpitPath = existing_path('C:\\www\\runtimes\\mailpit\\1.29.7\\mailpit.exe') ?? command_exists_path('mailpit');
$pgwebPath = existing_path('C:\\www\\runtimes\\pgweb\\0.16.2\\pgweb.exe') ?? command_exists_path('pgweb');
$redisPath = existing_path('C:\\www\\runtimes\\redis\\8.6.2\\Redis-8.6.2-Windows-x64-msys2\\redis-server.exe') ?? command_exists_path('redis-server');

$localhostReady = in_array(80, $ports, true);
$phpMyAdminReady = $localhostReady && in_array(9000, $ports, true);

$services = [
    [
        'key' => 'nginx',
        'label' => 'nginx',
        'status' => isset($processes['nginx.exe']) ? 'running' : 'stopped',
        'detail' => 'Web server for localhost and phpMyAdmin',
        'port' => in_array(80, $ports, true) ? 80 : null,
        'pid' => $processes['nginx.exe'] ?? null,
        'canReload' => true,
        'kind' => 'process',
        'currentVersion' => $nginxCurrent,
        'versions' => $nginxVersions,
        'launchTarget' => null,
    ],
    [
        'key' => 'php_cgi',
        'label' => 'PHP-CGI',
        'status' => isset($processes['php-cgi.exe']) ? 'running' : 'stopped',
        'detail' => 'FastCGI bridge for PHP requests',
        'port' => in_array(9000, $ports, true) ? 9000 : null,
        'pid' => $processes['php-cgi.exe'] ?? null,
        'canReload' => false,
        'kind' => 'process',
        'currentVersion' => $phpCurrent,
        'versions' => $phpVersions,
        'launchTarget' => null,
    ],
    [
        'key' => 'mariadb',
        'label' => 'MariaDB',
        'status' => windows_service_status('MariaDB'),
        'detail' => 'Primary local database service',
        'port' => in_array(3306, $ports, true) ? 3306 : null,
        'pid' => $processes['mariadb.exe'] ?? null,
        'canReload' => false,
        'kind' => 'windows-service',
        'currentVersion' => '12.2.2',
        'versions' => ['12.2.2'],
        'launchTarget' => null,
    ],
    [
        'key' => 'postgresql',
        'label' => 'PostgreSQL',
        'status' => windows_service_status('postgresql-x64-17'),
        'detail' => 'Primary PostgreSQL database service',
        'port' => in_array(5432, $ports, true) ? 5432 : null,
        'pid' => $processes['postgres.exe'] ?? null,
        'canReload' => false,
        'kind' => 'windows-service',
        'currentVersion' => '17.9',
        'versions' => ['17.9'],
        'launchTarget' => null,
    ],
    [
        'key' => 'mailpit',
        'label' => 'Mailpit',
        'status' => isset($processes['mailpit.exe']) ? 'running' : 'stopped',
        'detail' => 'Local SMTP catcher and mail inbox',
        'port' => in_array(8025, $ports, true) ? 8025 : null,
        'pid' => $processes['mailpit.exe'] ?? null,
        'canReload' => false,
        'kind' => 'process',
        'currentVersion' => '1.29.7',
        'versions' => ['1.29.7'],
        'launchTarget' => $mailpitPath,
    ],
    [
        'key' => 'pgweb',
        'label' => 'Pgweb',
        'status' => isset($processes['pgweb.exe']) ? 'running' : 'stopped',
        'detail' => 'Lightweight PostgreSQL web client',
        'port' => in_array(8081, $ports, true) ? 8081 : null,
        'pid' => $processes['pgweb.exe'] ?? null,
        'canReload' => false,
        'kind' => 'process',
        'currentVersion' => '0.16.2',
        'versions' => ['0.16.2'],
        'launchTarget' => $pgwebPath,
    ],
    [
        'key' => 'redis',
        'label' => 'Redis',
        'status' => isset($processes['redis-server.exe']) ? 'running' : 'stopped',
        'detail' => 'In-memory cache and queue backend',
        'port' => in_array(6379, $ports, true) ? 6379 : null,
        'pid' => $processes['redis-server.exe'] ?? null,
        'canReload' => false,
        'kind' => 'process',
        'currentVersion' => '8.6.2',
        'versions' => ['8.6.2'],
        'launchTarget' => $redisPath,
    ],
    [
        'key' => 'memcached',
        'label' => 'Memcached',
        'status' => in_array(11211, $ports, true) ? 'running' : 'stopped',
        'detail' => 'Embedded local memory cache for dev',
        'port' => in_array(11211, $ports, true) ? 11211 : null,
        'pid' => null,
        'canReload' => false,
        'kind' => 'process',
        'currentVersion' => 'lite',
        'versions' => ['lite'],
        'launchTarget' => '127.0.0.1:11211',
    ],
    [
        'key' => 'localhost',
        'label' => 'Localhost',
        'status' => $localhostReady ? 'running' : 'stopped',
        'detail' => 'Shortcut ke root local web environment',
        'port' => $localhostReady ? 80 : null,
        'pid' => $processes['nginx.exe'] ?? null,
        'canReload' => false,
        'kind' => 'app',
        'currentVersion' => 'ready',
        'versions' => [],
        'launchTarget' => 'http://localhost/',
    ],
    [
        'key' => 'phpmyadmin',
        'label' => 'phpMyAdmin',
        'status' => $phpMyAdminReady ? 'running' : 'stopped',
        'detail' => 'Admin panel database lokal',
        'port' => $localhostReady ? 80 : null,
        'pid' => $processes['php-cgi.exe'] ?? null,
        'canReload' => false,
        'kind' => 'app',
        'currentVersion' => 'ready',
        'versions' => [],
        'launchTarget' => 'http://localhost/phpmyadmin/',
    ],
    [
        'key' => 'nodejs',
        'label' => 'Node.js',
        'status' => installed_status($nodePath),
        'detail' => 'JavaScript runtime untuk tooling dan frontend',
        'port' => null,
        'pid' => $processes['node.exe'] ?? null,
        'canReload' => false,
        'kind' => 'runtime',
        'currentVersion' => $nodeCurrent,
        'versions' => $nodeVersions,
        'launchTarget' => $nodePath,
    ],
    [
        'key' => 'python',
        'label' => 'Python',
        'status' => installed_status($pythonPath),
        'detail' => 'Runtime scripting dan automation',
        'port' => null,
        'pid' => $processes['python.exe'] ?? null,
        'canReload' => false,
        'kind' => 'runtime',
        'currentVersion' => command_version('python', ['--version']),
        'versions' => [],
        'launchTarget' => $pythonPath,
    ],
    [
        'key' => 'go',
        'label' => 'Go',
        'status' => installed_status($goPath),
        'detail' => 'Runtime dan toolchain Go',
        'port' => null,
        'pid' => $processes['go.exe'] ?? null,
        'canReload' => false,
        'kind' => 'runtime',
        'currentVersion' => command_version('go', ['version']),
        'versions' => [],
        'launchTarget' => $goPath,
    ],
    [
        'key' => 'git',
        'label' => 'Git',
        'status' => installed_status($gitPath),
        'detail' => 'Version control tooling',
        'port' => null,
        'pid' => $processes['git.exe'] ?? null,
        'canReload' => false,
        'kind' => 'runtime',
        'currentVersion' => command_version('git', ['--version']),
        'versions' => [],
        'launchTarget' => $gitPath,
    ],
];

json_response($services);
