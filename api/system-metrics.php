<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$script = <<<'PS'
$cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average; $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue; $totalMemGb = $null; $usedMemGb = $null; if ($null -ne $os) { $totalMemBytes = [double]$os.TotalVisibleMemorySize * 1KB; $freeMemBytes = [double]$os.FreePhysicalMemory * 1KB; $usedMemBytes = $totalMemBytes - $freeMemBytes; $totalMemGb = [math]::Round($totalMemBytes / 1GB, 1); $usedMemGb = [math]::Round($usedMemBytes / 1GB, 1) }; $disk = Get-PSDrive -Name C -ErrorAction SilentlyContinue; $diskTotalGb = $null; $diskUsedGb = $null; if ($null -ne $disk) { $diskTotalGb = [math]::Round(([double]($disk.Used + $disk.Free) / 1GB), 1); $diskUsedGb = [math]::Round(([double]$disk.Used / 1GB), 1) }; $network = Get-Counter '\Network Interface(*)\Bytes Received/sec','\Network Interface(*)\Bytes Sent/sec' -ErrorAction SilentlyContinue; $download = $null; $upload = $null; if ($null -ne $network) { $downloadBytes = ($network.CounterSamples | Where-Object { $_.Path -like '*Bytes Received/sec' } | Measure-Object -Property CookedValue -Sum).Sum; $uploadBytes = ($network.CounterSamples | Where-Object { $_.Path -like '*Bytes Sent/sec' } | Measure-Object -Property CookedValue -Sum).Sum; $download = [math]::Round(([double]$downloadBytes / 1KB), 1); $upload = [math]::Round(([double]$uploadBytes / 1KB), 1) }; [pscustomobject]@{ cpu_percent = if ($null -ne $cpu) { [math]::Round([double]$cpu, 1) } else { $null }; memory_used_gb = $usedMemGb; memory_total_gb = $totalMemGb; disk_used_gb = $diskUsedGb; disk_total_gb = $diskTotalGb; download_kbps = $download; upload_kbps = $upload } | ConvertTo-Json -Depth 3
PS;

$result = run_powershell($script);
if ($result['code'] !== 0 || $result['output'] === '') {
    json_response([
        'cpu_percent' => null,
        'memory_used_gb' => null,
        'memory_total_gb' => null,
        'disk_used_gb' => null,
        'disk_total_gb' => null,
        'download_kbps' => null,
        'upload_kbps' => null,
    ]);
}

$decoded = json_decode($result['output'], true);
if (!is_array($decoded)) {
    json_response([
        'cpu_percent' => null,
        'memory_used_gb' => null,
        'memory_total_gb' => null,
        'disk_used_gb' => null,
        'disk_total_gb' => null,
        'download_kbps' => null,
        'upload_kbps' => null,
    ]);
}

json_response($decoded);
