<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const PROJECTS_WEB_ROOT = 'C:\\www';
const PROJECTS_VHOSTS_FILE = 'C:\\www\\rhinobox\\virtual-hosts.json';

function project_vhost_records(): array
{
    if (!file_exists(PROJECTS_VHOSTS_FILE)) {
        return [];
    }

    $records = json_decode(file_get_contents(PROJECTS_VHOSTS_FILE) ?: '[]', true);
    return is_array($records) ? $records : [];
}

function normalize_project_path(string $path): string
{
    return strtolower(rtrim(str_replace('/', '\\', $path), '\\'));
}

function project_has(string $path, string $relative): bool
{
    return file_exists($path . '\\' . $relative);
}

function detect_project_kind_php(string $path): string
{
    if (project_has($path, 'artisan')) {
        return 'Laravel';
    }
    if (project_has($path, 'wp-config.php') || project_has($path, 'wp-content')) {
        return 'WordPress';
    }
    if (project_has($path, 'composer.json')) {
        return 'PHP';
    }
    if (project_has($path, 'package.json')) {
        return 'Node.js';
    }
    if (project_has($path, 'go.mod')) {
        return 'Go';
    }
    if (project_has($path, 'pyproject.toml') || project_has($path, 'requirements.txt')) {
        return 'Python';
    }
    if (project_has($path, 'index.php') || project_has($path, 'public\\index.php')) {
        return 'PHP site';
    }
    if (project_has($path, 'index.html') || project_has($path, 'public\\index.html')) {
        return 'Static site';
    }
    return 'Folder';
}

function project_domain_for(string $name, string $path, array $records): ?string
{
    $normalized = normalize_project_path($path);
    foreach ($records as $record) {
        $root = isset($record['root']) ? (string) $record['root'] : '';
        $recordName = isset($record['name']) ? (string) $record['name'] : '';
        if (normalize_project_path($root) === $normalized || strcasecmp($recordName, $name) === 0) {
            $domain = isset($record['domain']) ? trim((string) $record['domain']) : '';
            return $domain !== '' ? $domain : null;
        }
    }
    return null;
}

$ignored = ['phpmyadmin', 'rhinobox', 'runtimes'];
$records = project_vhost_records();
$projects = [];

if (is_dir(PROJECTS_WEB_ROOT)) {
    foreach (scandir(PROJECTS_WEB_ROOT) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..' || str_starts_with($entry, '.')) {
            continue;
        }
        if (in_array(strtolower($entry), $ignored, true)) {
            continue;
        }

        $path = PROJECTS_WEB_ROOT . '\\' . $entry;
        if (!is_dir($path)) {
            continue;
        }

        $domain = project_domain_for($entry, $path, $records);
        $projects[] = [
            'name' => $entry,
            'path' => $path,
            'kind' => detect_project_kind_php($path),
            'domain' => $domain,
            'url' => $domain ? "http://{$domain}/" : "http://localhost/{$entry}/",
            'hasVhost' => $domain !== null,
            'hasPublicDir' => is_dir($path . '\\public'),
        ];
    }
}

usort($projects, static fn(array $left, array $right): int => strcasecmp((string) $left['name'], (string) $right['name']));

json_response($projects);
