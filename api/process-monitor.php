<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$detailed = isset($_GET['detailed']) && $_GET['detailed'] === '1';

if (!$detailed) {
    $result = run_command('tasklist /FO CSV /NH');
    if ($result['code'] !== 0 || $result['output'] === '') {
        json_response(['error' => 'Failed to collect process metrics'], 500);
    }

    $payload = [];
    foreach (preg_split('/\R/', $result['output']) as $line) {
        $fields = str_getcsv(trim($line), ',', '"', '\\');
        if (!isset($fields[0], $fields[1], $fields[4]) || !is_numeric($fields[1])) {
            continue;
        }

        $memoryMb = null;
        if (preg_match('/([\d.,]+)/', $fields[4], $matches)) {
            $memoryKb = (float) str_replace([',', '.'], '', $matches[1]);
            if ($memoryKb > 0) {
                $memoryMb = round($memoryKb / 1024, 1);
            }
        }

        $payload[] = [
            'key' => strtolower($fields[0]) . '-' . $fields[1],
            'label' => $fields[0],
            'status' => 'running',
            'pid' => (int) $fields[1],
            'port' => null,
            'memoryMb' => $memoryMb,
            'cpuSeconds' => null,
            'kind' => 'process',
            'path' => null,
            'canKill' => false,
        ];
    }

    json_response($payload);
}

$script = <<<'PS'
$ports = @{}
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Group-Object OwningProcess |
  ForEach-Object {
    $first = $_.Group | Select-Object -First 1
    if ($null -ne $first) {
      $ports[[int]$_.Name] = [int]$first.LocalPort
    }
  }

$procIndex = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
  $procIndex[[int]$_.Id] = $_
}

$payload = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    $proc = $null
    if ($procIndex.ContainsKey([int]$_.ProcessId)) {
      $proc = $procIndex[[int]$_.ProcessId]
    }

    [pscustomobject]@{
      key = ($_.Name.ToLower() + '-' + $_.ProcessId)
      label = $_.Name
      status = 'running'
      pid = [int]$_.ProcessId
      port = if ($ports.ContainsKey([int]$_.ProcessId)) { [int]$ports[[int]$_.ProcessId] } else { $null }
      memoryMb = if ($null -ne $proc) { [math]::Round($proc.WorkingSet64 / 1MB, 1) } else { $null }
      cpuSeconds = if ($null -ne $proc -and $null -ne $proc.CPU) { [math]::Round($proc.CPU, 1) } else { $null }
      kind = 'process'
      path = $_.ExecutablePath
      canKill = $false
    }
  }

$payload | ConvertTo-Json -Depth 4
PS;

$result = run_powershell($script);
if ($result['code'] !== 0 || $result['output'] === '') {
    json_response(['error' => 'Failed to collect process metrics'], 500);
}

$payload = json_decode($result['output'], true);
if (is_array($payload) && array_key_exists('key', $payload)) {
    $payload = [$payload];
}

if (!is_array($payload)) {
    json_response(['error' => 'Invalid process payload'], 500);
}

json_response($payload);
