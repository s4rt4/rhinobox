param(
    [string] $Configuration = "release",
    [switch] $SkipBuild,
    [switch] $IncludeRuntimes,
    [switch] $IncludeDatabases,
    [switch] $IncludePhpMyAdmin
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath (Join-Path $root "package.json") | ConvertFrom-Json).version
$portableRoot = Join-Path $root "portable\RhinoBOX-$version"
$exePath = Join-Path $root "src-tauri\target\$Configuration\rhinobox.exe"

if (-not $SkipBuild) {
    Push-Location $root
    try {
        npm run tauri -- build --bundles nsis
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $exePath)) {
    throw "RhinoBOX executable not found: $exePath"
}

if (Test-Path -LiteralPath $portableRoot) {
    Remove-Item -LiteralPath $portableRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $portableRoot "www") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $portableRoot "config\nginx\vhosts") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $portableRoot "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $portableRoot "runtimes") | Out-Null

Copy-Item -LiteralPath $exePath -Destination (Join-Path $portableRoot "RhinoBOX.exe") -Force
Set-Content -LiteralPath (Join-Path $portableRoot "portable.txt") -Value "RhinoBOX portable home" -Encoding UTF8

$index = @"
<!doctype html>
<html>
<head><meta charset="utf-8"><title>RhinoBOX Portable</title></head>
<body style="font-family:Segoe UI,sans-serif;padding:32px">
  <h1>RhinoBOX Portable is ready</h1>
  <p>This is the portable web root.</p>
</body>
</html>
"@
Set-Content -LiteralPath (Join-Path $portableRoot "www\index.html") -Value $index -Encoding UTF8

if ($IncludeRuntimes) {
    $sourceRuntimes = Join-Path $root "runtimes"
    if (-not (Test-Path -LiteralPath $sourceRuntimes)) {
        $sourceRuntimes = "C:\www\runtimes"
    }
    if (Test-Path -LiteralPath $sourceRuntimes) {
        $runtimeDest = Join-Path $portableRoot "runtimes"
        robocopy $sourceRuntimes $runtimeDest /E /XD _downloads /XF *.zip | Out-Host
        if ($LASTEXITCODE -gt 7) {
            throw "Failed to copy runtimes from $sourceRuntimes"
        }
    }
}

if ($IncludeDatabases) {
    $mariaSource = "C:\Program Files\MariaDB 12.2"
    $mariaDest = Join-Path $portableRoot "runtimes\mariadb\12.2.2"
    if (Test-Path -LiteralPath (Join-Path $mariaSource "bin\mariadbd.exe")) {
        New-Item -ItemType Directory -Force -Path $mariaDest | Out-Null
        robocopy $mariaSource $mariaDest /E /XD data /XF *.pdb *.log | Out-Host
        if ($LASTEXITCODE -gt 7) {
            throw "Failed to copy MariaDB from $mariaSource"
        }
    } else {
        Write-Warning "MariaDB source not found: $mariaSource"
    }

    $postgresSource = "C:\Program Files\PostgreSQL\17"
    $postgresDest = Join-Path $portableRoot "runtimes\postgresql\17"
    if (Test-Path -LiteralPath (Join-Path $postgresSource "bin\postgres.exe")) {
        New-Item -ItemType Directory -Force -Path $postgresDest | Out-Null
        robocopy $postgresSource $postgresDest /E /XD data "pgAdmin 4" doc installer /XF uninstall* *.pdb *.log | Out-Host
        if ($LASTEXITCODE -gt 7) {
            throw "Failed to copy PostgreSQL from $postgresSource"
        }
    } else {
        Write-Warning "PostgreSQL source not found: $postgresSource"
    }
}

if ($IncludePhpMyAdmin) {
    $sourcePhpMyAdmin = Join-Path (Split-Path -Parent $root) "phpmyadmin"
    if (Test-Path -LiteralPath $sourcePhpMyAdmin) {
        Copy-Item -LiteralPath $sourcePhpMyAdmin -Destination (Join-Path $portableRoot "www\phpmyadmin") -Recurse -Force
    }
}

$zipPath = Join-Path $root "portable\RhinoBOX-$version-portable.zip"
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -LiteralPath $portableRoot -DestinationPath $zipPath -Force

Write-Host "Portable package created:"
Write-Host $zipPath
