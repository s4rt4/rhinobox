<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

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
