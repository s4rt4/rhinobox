<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const SERVICE_SELECTION_FILE = 'C:\\www\\rhinobox\\service-selection.json';

function run_powershell(string $script): array
{
    $command = 'powershell -NoProfile -ExecutionPolicy Bypass -Command ' . escapeshellarg($script);
    return run_command($command);
}

function run_command(string $command): array
{
    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);

    return [
        'output' => trim(implode("\n", $output)),
        'code' => $exitCode,
    ];
}

function ps_output(string $script): string
{
    $result = run_powershell($script);
    return $result['output'];
}

function process_id(string $name): ?int
{
    $output = ps_output("(Get-Process {$name} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id)");
    return is_numeric($output) ? (int) $output : null;
}

function process_running(string $name): bool
{
    return process_id($name) !== null;
}

function port_listening(int $port): bool
{
    $output = ps_output("if (Get-NetTCPConnection -LocalPort {$port} -State Listen -ErrorAction SilentlyContinue) { 'true' } else { 'false' }");
    return trim($output) === 'true';
}

function windows_service_status(string $name): string
{
    $output = ps_output("\$svc = Get-Service -Name '{$name}' -ErrorAction SilentlyContinue; if (\$null -eq \$svc) { 'unknown' } elseif (\$svc.Status -eq 'Running') { 'running' } else { 'stopped' }");
    return in_array($output, ['running', 'stopped', 'unknown'], true) ? $output : 'unknown';
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function existing_path(?string $path): ?string
{
    return is_string($path) && $path !== '' && file_exists($path) ? $path : null;
}

function command_exists_path(string $command): ?string
{
    $result = run_command('where ' . escapeshellarg($command));
    if ($result['code'] !== 0 || $result['output'] === '') {
        return null;
    }

    foreach (preg_split('/\R/', $result['output']) as $line) {
        $candidate = trim($line);
        if ($candidate !== '' && file_exists($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function command_version_from_path(string $path, array $args): ?string
{
    if (!file_exists($path)) {
        return null;
    }

    $quotedArgs = array_map(static fn(string $arg): string => escapeshellarg($arg), $args);
    $result = run_command(escapeshellarg($path) . ' ' . implode(' ', $quotedArgs));
    if ($result['code'] !== 0 || $result['output'] === '') {
        return null;
    }

    return trim(preg_replace('/^[^\d]*v?/i', '', trim($result['output'])) ?? '');
}

function command_version(string $command, array $args): ?string
{
    $path = command_exists_path($command);
    return $path ? command_version_from_path($path, $args) : null;
}

function runtime_version_dirs(string $root): array
{
    if (!is_dir($root)) {
        return [];
    }

    $versions = [];
    foreach (scandir($root) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        if (is_dir($root . '\\' . $entry)) {
            $versions[] = $entry;
        }
    }

    return $versions;
}

function sort_versions_desc(array $versions): array
{
    $versions = array_values(array_unique(array_filter($versions, static fn($value): bool => is_string($value) && $value !== '')));
    usort($versions, static function (string $left, string $right): int {
        return version_compare(ltrim($right, 'vV'), ltrim($left, 'vV'));
    });
    return $versions;
}

function nginx_default_version_path(): ?string
{
    $path = 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8';
    return is_dir($path) ? $path : null;
}

function nginx_version_paths(): array
{
    $paths = [];
    foreach (runtime_version_dirs('C:\\www\\runtimes\\nginx') as $version) {
        $candidate = "C:\\www\\runtimes\\nginx\\{$version}";
        $nested = $candidate . "\\nginx-{$version}";
        if (file_exists($candidate . '\\nginx.exe')) {
            $paths[$version] = $candidate;
        } elseif (file_exists($nested . '\\nginx.exe')) {
            $paths[$version] = $nested;
        }
    }

    $default = nginx_default_version_path();
    if ($default) {
        $paths['1.29.8'] = $default;
    }

    return $paths;
}

function nginx_versions(): array
{
    return sort_versions_desc(array_keys(nginx_version_paths()));
}

function nginx_version_path(?string $version): ?string
{
    $paths = nginx_version_paths();
    return $version && isset($paths[$version]) ? $paths[$version] : null;
}

function php_default_version_path(): ?string
{
    $path = 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe';
    return file_exists($path . '\\php.exe') ? $path : null;
}

function php_version_paths(): array
{
    $paths = [];
    foreach (runtime_version_dirs('C:\\www\\runtimes\\php') as $version) {
        $candidate = "C:\\www\\runtimes\\php\\{$version}";
        if (file_exists($candidate . '\\php.exe')) {
            $paths[$version] = $candidate;
        }
    }

    $default = php_default_version_path();
    if ($default) {
        $paths['8.4.20'] = $default;
    }

    return $paths;
}

function php_versions(): array
{
    return sort_versions_desc(array_keys(php_version_paths()));
}

function php_version_path(?string $version): ?string
{
    $paths = php_version_paths();
    return $version && isset($paths[$version]) ? $paths[$version] : null;
}

function node_version_paths(): array
{
    $paths = [];

    $primary = 'C:\\Program Files\\nodejs\\node.exe';
    if (file_exists($primary)) {
        $version = command_version_from_path($primary, ['--version']);
        if ($version) {
            $paths[$version] = $primary;
        }
    }

    $nvmRoot = getenv('LOCALAPPDATA') ? rtrim((string) getenv('LOCALAPPDATA'), '\\') . '\\nvm' : null;
    if ($nvmRoot && is_dir($nvmRoot)) {
        foreach (scandir($nvmRoot) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..' || $entry[0] !== 'v') {
                continue;
            }

            $candidate = $nvmRoot . '\\' . $entry . '\\node.exe';
            if (!file_exists($candidate)) {
                continue;
            }

            $paths[ltrim($entry, 'vV')] = $candidate;
        }
    }

    return $paths;
}

function node_versions(): array
{
    return sort_versions_desc(array_keys(node_version_paths()));
}

function node_version_path(?string $version): ?string
{
    $paths = node_version_paths();
    return $version && isset($paths[$version]) ? $paths[$version] : null;
}

function read_service_selection_state(): array
{
    if (!file_exists(SERVICE_SELECTION_FILE)) {
        return [
            'nginx' => null,
            'php_cgi' => null,
            'mariadb' => null,
            'postgresql' => null,
            'nodejs' => null,
            'mailpit' => null,
            'pgweb' => null,
            'redis' => null,
            'memcached' => null,
        ];
    }

    $decoded = json_decode(file_get_contents(SERVICE_SELECTION_FILE) ?: '[]', true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    return array_merge([
        'nginx' => null,
        'php_cgi' => null,
        'mariadb' => null,
        'postgresql' => null,
        'nodejs' => null,
        'mailpit' => null,
        'pgweb' => null,
        'redis' => null,
        'memcached' => null,
    ], $decoded);
}

function write_service_selection_state(array $state): bool
{
    $content = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    return is_string($content) && file_put_contents(SERVICE_SELECTION_FILE, $content) !== false;
}

function get_selected_service_version(string $key): ?string
{
    $state = read_service_selection_state();
    $value = $state[$key] ?? null;
    return is_string($value) && $value !== '' ? $value : null;
}

function set_selected_service_version(string $key, string $version): bool
{
    $state = read_service_selection_state();
    $state[$key] = $version;
    return write_service_selection_state($state);
}
