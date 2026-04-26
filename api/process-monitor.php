<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$script = <<<'PS'
$ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
$services = @(
  @{ key='nginx'; label='nginx'; process='nginx'; kind='process'; port=80 },
  @{ key='php_cgi'; label='PHP-CGI'; process='php-cgi'; kind='process'; port=9000 },
  @{ key='mariadb'; label='MariaDB'; process='mariadb'; kind='windows-service'; port=3306 }
)

$payload = foreach ($svc in $services) {
  $proc = Get-Process $svc.process -ErrorAction SilentlyContinue | Select-Object -First 1 Id, CPU, WorkingSet64
  $status = if ($svc.kind -eq 'windows-service') {
    $serviceState = Get-Service -Name 'MariaDB' -ErrorAction SilentlyContinue
    if ($null -eq $serviceState) { 'unknown' } elseif ($serviceState.Status -eq 'Running') { 'running' } else { 'stopped' }
  } elseif ($proc) {
    'running'
  } else {
    'stopped'
  }

  [pscustomobject]@{
    key = $svc.key
    label = $svc.label
    status = $status
    pid = if ($proc) { $proc.Id } else { $null }
    port = if ($ports.LocalPort -contains $svc.port) { $svc.port } else { $null }
    memoryMb = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { $null }
    cpuSeconds = if ($proc) { [math]::Round($proc.CPU, 1) } else { $null }
    kind = $svc.kind
  }
}

$payload | ConvertTo-Json -Depth 4
PS;

$result = run_powershell($script);
if ($result['code'] !== 0 || $result['output'] === '') {
    json_response(['error' => 'Failed to collect process metrics'], 500);
}

$payload = json_decode($result['output'], true);
if (!is_array($payload)) {
    json_response(['error' => 'Invalid process payload'], 500);
}

json_response($payload);
