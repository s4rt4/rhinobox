<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

const VHOSTS_FILE = 'C:\\www\\rhinobox\\virtual-hosts.json';
const VHOSTS_DIR = 'C:\\www\\rhinobox\\config\\nginx\\vhosts';

function vhost_records(): array
{
    if (!file_exists(VHOSTS_FILE)) {
        return [];
    }

    $records = json_decode(file_get_contents(VHOSTS_FILE) ?: '[]', true);
    return is_array($records) ? $records : [];
}

function write_vhost_records(array $records): bool
{
    $dir = dirname(VHOSTS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    return file_put_contents(VHOSTS_FILE, json_encode(array_values($records), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) !== false;
}

function sanitize_vhost_name_php(string $name): string
{
    $name = strtolower(trim($name));
    $name = preg_replace('/\.(test|local)$/', '', $name) ?? $name;
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $name)) {
        json_response(['ok' => false, 'error' => 'Use a simple project name like myapp or client-site'], 400);
    }
    return $name;
}

function sanitize_vhost_tld_php(string $tld): string
{
    $tld = strtolower(ltrim(trim($tld), '.'));
    if (!in_array($tld, ['test', 'local'], true)) {
        json_response(['ok' => false, 'error' => 'Only .test and .local are supported'], 400);
    }
    return $tld;
}

function vhost_config_path_php(string $domain): string
{
    return VHOSTS_DIR . '\\' . $domain . '.conf';
}

function hosts_contains_domain_php(string $domain): bool
{
    $hosts = @file_get_contents('C:\\Windows\\System32\\drivers\\etc\\hosts');
    if (!is_string($hosts)) {
        return false;
    }

    foreach (preg_split('/\R/', $hosts) as $line) {
        $trimmed = ltrim((string) $line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if (in_array($domain, preg_split('/\s+/', $trimmed) ?: [], true)) {
            return true;
        }
    }

    return false;
}

function ensure_nginx_vhost_include_php(): void
{
    if (!is_dir(VHOSTS_DIR)) {
        mkdir(VHOSTS_DIR, 0777, true);
    }

    $include = 'include C:/www/rhinobox/config/nginx/vhosts/*.conf;';
    foreach (nginx_version_paths() as $root) {
        $conf = $root . '\\conf\\nginx.conf';
        if (!file_exists($conf)) {
            continue;
        }

        $content = file_get_contents($conf);
        if (!is_string($content) || str_contains($content, $include)) {
            continue;
        }

        $pos = strrpos($content, "\n}");
        $next = $pos === false
            ? $content . "\n    {$include}\n"
            : substr($content, 0, $pos + 1) . "    {$include}\n" . substr($content, $pos + 1);
        file_put_contents($conf, $next);
    }
}

function vhost_nginx_config_php(string $domain, string $root): string
{
    $root = str_replace('\\', '/', $root);
    return "server {\n"
        . "    listen 80;\n"
        . "    server_name {$domain};\n"
        . "    root {$root};\n"
        . "    index index.php index.html index.htm;\n\n"
        . "    location / {\n"
        . "        try_files \$uri \$uri/ /index.php?\$query_string;\n"
        . "    }\n\n"
        . "    location ~ \\.php$ {\n"
        . "        include fastcgi_params;\n"
        . "        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;\n"
        . "        fastcgi_pass 127.0.0.1:9000;\n"
        . "    }\n"
        . "}\n";
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    $payload = array_map(static function (array $record): array {
        $domain = (string) ($record['domain'] ?? '');
        $configPath = vhost_config_path_php($domain);
        return [
            'name' => $record['name'] ?? '',
            'domain' => $domain,
            'root' => $record['root'] ?? '',
            'tld' => $record['tld'] ?? '',
            'configPath' => $configPath,
            'configExists' => file_exists($configPath),
            'hostsEnabled' => hosts_contains_domain_php($domain),
        ];
    }, vhost_records());

    json_response($payload);
}

$payload = json_decode(file_get_contents('php://input') ?: '[]', true);
if (!is_array($payload)) {
    json_response(['ok' => false, 'error' => 'Invalid payload'], 400);
}

if ($requestMethod === 'POST') {
    $name = sanitize_vhost_name_php((string) ($payload['name'] ?? ''));
    $tld = sanitize_vhost_tld_php((string) ($payload['tld'] ?? 'test'));
    $root = trim((string) ($payload['root'] ?? '')) ?: "C:\\www\\{$name}";
    $domain = "{$name}.{$tld}";

    if (!is_dir($root)) {
        mkdir($root, 0777, true);
    }

    $index = $root . '\\index.php';
    if (!file_exists($index)) {
        file_put_contents($index, "<?php\nphpinfo();\n// {$domain}\n");
    }

    if (!is_dir(VHOSTS_DIR)) {
        mkdir(VHOSTS_DIR, 0777, true);
    }
    file_put_contents(vhost_config_path_php($domain), vhost_nginx_config_php($domain, $root));
    ensure_nginx_vhost_include_php();

    $records = array_filter(vhost_records(), static fn(array $record): bool => ($record['domain'] ?? '') !== $domain);
    $records[] = ['name' => $name, 'domain' => $domain, 'root' => $root, 'tld' => $tld];
    usort($records, static fn(array $left, array $right): int => strcmp((string) $left['domain'], (string) $right['domain']));
    write_vhost_records($records);

    $hostsMessage = 'hosts file unchanged';
    if (!hosts_contains_domain_php($domain)) {
        $hostsLine = "127.0.0.1 {$domain} # RhinoBOX";
        $hostsMessage = @file_put_contents('C:\\Windows\\System32\\drivers\\etc\\hosts', "\r\n{$hostsLine}\r\n", FILE_APPEND) === false
            ? 'hosts update needs Windows admin rights'
            : 'hosts file updated';
    }

    json_response(['ok' => true, 'message' => "{$domain} created; {$hostsMessage}; restart nginx to apply"]);
}

if ($requestMethod === 'DELETE') {
    $domain = strtolower(trim((string) ($payload['domain'] ?? '')));
    if ($domain === '') {
        json_response(['ok' => false, 'error' => 'Domain is required'], 400);
    }

    $configPath = vhost_config_path_php($domain);
    if (file_exists($configPath)) {
        unlink($configPath);
    }

    $records = array_filter(vhost_records(), static fn(array $record): bool => ($record['domain'] ?? '') !== $domain);
    write_vhost_records($records);

    json_response(['ok' => true, 'message' => "{$domain} removed; restart nginx to apply"]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
