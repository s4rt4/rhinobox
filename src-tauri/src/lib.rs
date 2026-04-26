use serde::{Deserialize, Serialize};
use std::{fs, path::Path, process::Command};
use tauri::Manager;

const SERVICE_SELECTION_FILE: &str = "C:\\www\\rhinobox\\service-selection.json";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ServiceStatus {
    Running,
    Stopped,
    Unknown,
}

#[derive(Serialize)]
struct ManagedService {
    key: String,
    label: String,
    status: ServiceStatus,
    detail: String,
    port: Option<u16>,
    pid: Option<u32>,
    can_reload: bool,
    kind: String,
    current_version: Option<String>,
    versions: Vec<String>,
    launch_target: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct ServiceSelectionState {
    nginx: Option<String>,
    php_cgi: Option<String>,
    mariadb: Option<String>,
}

#[derive(Serialize)]
struct DiscoveryItem {
    key: String,
    label: String,
    value: String,
    source: String,
    available: Option<bool>,
}

#[derive(Serialize, Clone)]
struct ConfigFileSummary {
    key: String,
    label: String,
    path: String,
    service_key: Option<String>,
    exists: Option<bool>,
}

#[derive(Serialize)]
struct ConfigFileDetail {
    key: String,
    label: String,
    path: String,
    content: String,
}

#[derive(Serialize)]
struct LogTarget {
    key: String,
    label: String,
    path: String,
    available: bool,
    lines: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct ProcessMetric {
    key: String,
    label: String,
    status: ServiceStatus,
    pid: Option<u32>,
    port: Option<u16>,
    memory_mb: Option<f64>,
    cpu_seconds: Option<f64>,
    kind: String,
    path: Option<String>,
    can_kill: bool,
}

fn powershell(script: &str) -> Result<String, String> {
    let output = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(format!("{program} exited with status {}", output.status))
        } else {
            Err(stderr)
        }
    }
}

fn command_exists_path(command: &str) -> Option<String> {
    command_output("where", &[command]).ok().and_then(|output| {
        output
            .lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .map(|line| line.to_string())
    })
}

fn command_version(program: &str, args: &[&str]) -> Option<String> {
    command_output(program, args)
        .ok()
        .and_then(|output| output.lines().next().map(|line| line.trim().to_string()))
}

fn installed_status(path: Option<&String>) -> ServiceStatus {
    if path.is_some() {
        ServiceStatus::Running
    } else {
        ServiceStatus::Stopped
    }
}

fn exe_name(name: &str) -> String {
    if name.to_ascii_lowercase().ends_with(".exe") {
        name.to_string()
    } else {
        format!("{name}.exe")
    }
}

fn parse_tasklist_pid(line: &str) -> Option<u32> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let parts: Vec<&str> = trimmed.split("\",\"").collect();
    if parts.len() < 2 {
        return None;
    }

    let pid = parts.get(1)?.trim_matches('"');
    pid.parse::<u32>().ok()
}

fn process_id_by_name(name: &str) -> Option<u32> {
    let image = exe_name(name);
    let filter = format!("IMAGENAME eq {image}");
    let output = command_output("tasklist", &["/FO", "CSV", "/NH", "/FI", &filter]).ok()?;
    output.lines().find_map(parse_tasklist_pid)
}

fn port_is_listening(port: u16) -> bool {
    let marker = format!(":{port}");
    command_output("netstat", &["-ano", "-p", "tcp"])
        .ok()
        .map(|output| {
            output.lines().any(|line| {
                let upper = line.to_ascii_uppercase();
                upper.contains("LISTENING") && line.contains(&marker)
            })
        })
        .unwrap_or(false)
}

fn windows_service_status(name: &str) -> ServiceStatus {
    match command_output("sc", &["query", name]) {
        Ok(output) => {
            let upper = output.to_ascii_uppercase();
            if upper.contains("RUNNING") {
                ServiceStatus::Running
            } else if upper.contains("STOPPED") {
                ServiceStatus::Stopped
            } else {
                ServiceStatus::Unknown
            }
        }
        Err(_) => ServiceStatus::Unknown,
    }
}

fn process_status(name: &str) -> ServiceStatus {
    if process_id_by_name(name).is_some() {
        ServiceStatus::Running
    } else {
        ServiceStatus::Stopped
    }
}

fn config_files() -> Vec<ConfigFileSummary> {
    vec![
        ConfigFileSummary {
            key: "nginx".into(),
            label: "nginx.conf".into(),
            path: "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf".into(),
            service_key: Some("nginx".into()),
            exists: Some(Path::new("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf").exists()),
        },
        ConfigFileSummary {
            key: "php".into(),
            label: "php.ini".into(),
            path: "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini".into(),
            service_key: Some("php_cgi".into()),
            exists: Some(Path::new("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini").exists()),
        },
    ]
}

fn read_service_selection_state() -> ServiceSelectionState {
    fs::read_to_string(SERVICE_SELECTION_FILE)
        .ok()
        .and_then(|content| serde_json::from_str::<ServiceSelectionState>(&content).ok())
        .unwrap_or_default()
}

fn write_service_selection_state(state: &ServiceSelectionState) -> Result<(), String> {
    let content = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(SERVICE_SELECTION_FILE, content).map_err(|e| e.to_string())
}

fn get_selected_service_version(key: &str) -> Option<String> {
    let state = read_service_selection_state();
    match key {
        "nginx" => state.nginx,
        "php_cgi" => state.php_cgi,
        "mariadb" => state.mariadb,
        _ => None,
    }
}

fn set_selected_service_version(key: &str, version: &str) -> Result<(), String> {
    let mut state = read_service_selection_state();
    match key {
        "nginx" => state.nginx = Some(version.to_string()),
        "php_cgi" => state.php_cgi = Some(version.to_string()),
        "mariadb" => state.mariadb = Some(version.to_string()),
        _ => return Err("Unknown service key".into()),
    }
    write_service_selection_state(&state)
}

fn nginx_version_path(version: &str) -> Option<String> {
    match version {
        "1.29.8" => Some("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8".into()),
        "1.30.0" => Some("C:\\www\\runtimes\\nginx\\1.30.0\\nginx-1.30.0".into()),
        _ => None,
    }
}

fn php_version_path(version: &str) -> Option<String> {
    match version {
        "8.1.34" => Some("C:\\www\\runtimes\\php\\8.1.34".into()),
        "8.3.30" => Some("C:\\www\\runtimes\\php\\8.3.30".into()),
        "8.4.20" => Some("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe".into()),
        "8.5.5" => Some("C:\\www\\runtimes\\php\\8.5.5".into()),
        _ => None,
    }
}

fn installed_nginx_versions() -> Vec<String> {
    ["1.29.8", "1.30.0"]
        .into_iter()
        .filter(|version| {
            nginx_version_path(version)
                .map(|path| Path::new(&path).exists())
                .unwrap_or(false)
        })
        .map(|version| version.to_string())
        .collect()
}

fn installed_php_versions() -> Vec<String> {
    ["8.1.34", "8.3.30", "8.4.20", "8.5.5"]
        .into_iter()
        .filter(|version| {
            php_version_path(version)
                .map(|path| Path::new(&path).exists())
                .unwrap_or(false)
        })
        .map(|version| version.to_string())
        .collect()
}

fn service_versions(key: &str) -> Vec<String> {
    match key {
        "nginx" => installed_nginx_versions(),
        "php_cgi" => installed_php_versions(),
        "mariadb" => vec!["12.2.2".into()],
        _ => Vec::new(),
    }
}

fn tail_lines(path: &str, max_lines: usize) -> Vec<String> {
    match fs::read_to_string(path) {
        Ok(content) => {
            let mut lines: Vec<String> = content.lines().map(|line| line.to_string()).collect();
            if lines.len() > max_lines {
                lines = lines.split_off(lines.len() - max_lines);
            }
            lines
        }
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
fn get_services() -> Vec<ManagedService> {
    let nginx_versions = service_versions("nginx");
    let php_versions = service_versions("php_cgi");
    let mariadb_versions = service_versions("mariadb");
    let nginx_current = get_selected_service_version("nginx")
        .or_else(|| nginx_versions.first().cloned());
    let php_current = get_selected_service_version("php_cgi")
        .or_else(|| php_versions.iter().find(|version| version.as_str() == "8.4.20").cloned())
        .or_else(|| php_versions.first().cloned());
    let mariadb_current = get_selected_service_version("mariadb")
        .or_else(|| mariadb_versions.first().cloned());
    let node_path = command_exists_path("C:\\Program Files\\nodejs\\node.exe")
        .or_else(|| command_exists_path("node"));
    let python_path = command_exists_path("python");
    let go_path = command_exists_path("go");
    let localhost_ready = port_is_listening(80);
    let phpmyadmin_ready = localhost_ready && port_is_listening(9000);

    vec![
        ManagedService {
            key: "nginx".into(),
            label: "nginx".into(),
            status: process_status("nginx"),
            detail: "Web server for localhost and phpMyAdmin".into(),
            port: Some(80),
            pid: process_id_by_name("nginx"),
            can_reload: true,
            kind: "process".into(),
            current_version: nginx_current,
            versions: nginx_versions,
            launch_target: None,
        },
        ManagedService {
            key: "php_cgi".into(),
            label: "PHP-CGI".into(),
            status: process_status("php-cgi"),
            detail: "FastCGI bridge for PHP requests".into(),
            port: if port_is_listening(9000) { Some(9000) } else { None },
            pid: process_id_by_name("php-cgi"),
            can_reload: false,
            kind: "process".into(),
            current_version: php_current,
            versions: php_versions,
            launch_target: None,
        },
        ManagedService {
            key: "mariadb".into(),
            label: "MariaDB".into(),
            status: windows_service_status("MariaDB"),
            detail: "Primary local database service".into(),
            port: if port_is_listening(3306) { Some(3306) } else { None },
            pid: process_id_by_name("mariadb"),
            can_reload: false,
            kind: "windows-service".into(),
            current_version: mariadb_current,
            versions: mariadb_versions,
            launch_target: None,
        },
        ManagedService {
            key: "localhost".into(),
            label: "Localhost".into(),
            status: if localhost_ready { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Landing page lokal untuk stack web kamu".into(),
            port: if localhost_ready { Some(80) } else { None },
            pid: process_id_by_name("nginx"),
            can_reload: false,
            kind: "app".into(),
            current_version: Some("http://localhost".into()),
            versions: Vec::new(),
            launch_target: Some("http://localhost/".into()),
        },
        ManagedService {
            key: "phpmyadmin".into(),
            label: "phpMyAdmin".into(),
            status: if phpmyadmin_ready { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Admin panel database lokal".into(),
            port: if localhost_ready { Some(80) } else { None },
            pid: process_id_by_name("php-cgi"),
            can_reload: false,
            kind: "app".into(),
            current_version: Some("ready".into()),
            versions: Vec::new(),
            launch_target: Some("http://localhost/phpmyadmin/".into()),
        },
        ManagedService {
            key: "nodejs".into(),
            label: "Node.js".into(),
            status: installed_status(node_path.as_ref()),
            detail: "JavaScript runtime untuk tooling dan frontend".into(),
            port: None,
            pid: process_id_by_name("node"),
            can_reload: false,
            kind: "runtime".into(),
            current_version: command_version("C:\\Program Files\\nodejs\\node.exe", &["-v"])
                .or_else(|| command_version("node", &["-v"])),
            versions: Vec::new(),
            launch_target: node_path,
        },
        ManagedService {
            key: "python".into(),
            label: "Python".into(),
            status: installed_status(python_path.as_ref()),
            detail: "Runtime scripting dan automation".into(),
            port: None,
            pid: process_id_by_name("python"),
            can_reload: false,
            kind: "runtime".into(),
            current_version: command_version("python", &["--version"]),
            versions: Vec::new(),
            launch_target: python_path,
        },
        ManagedService {
            key: "go".into(),
            label: "Go".into(),
            status: installed_status(go_path.as_ref()),
            detail: "Runtime dan toolchain Go".into(),
            port: None,
            pid: process_id_by_name("go"),
            can_reload: false,
            kind: "runtime".into(),
            current_version: command_version("go", &["version"]),
            versions: Vec::new(),
            launch_target: go_path,
        },
    ]
}

#[tauri::command]
fn get_discovery() -> Vec<DiscoveryItem> {
    vec![
        DiscoveryItem {
            key: "workspace".into(),
            label: "Workspace".into(),
            value: "C:\\www\\rhinobox".into(),
            source: "derived".into(),
            available: Some(Path::new("C:\\www\\rhinobox").exists()),
        },
        DiscoveryItem {
            key: "web_root".into(),
            label: "Web root".into(),
            value: "C:\\www".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\www").exists()),
        },
        DiscoveryItem {
            key: "nginx_conf".into(),
            label: "nginx.conf".into(),
            value: "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\conf\\nginx.conf").exists()),
        },
        DiscoveryItem {
            key: "php_ini".into(),
            label: "php.ini".into(),
            value: "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\\php.ini").exists()),
        },
        DiscoveryItem {
            key: "phpmyadmin".into(),
            label: "phpMyAdmin".into(),
            value: "C:\\www\\phpmyadmin".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\www\\phpmyadmin").exists()),
        },
        DiscoveryItem {
            key: "mariadb_service".into(),
            label: "MariaDB service".into(),
            value: "MariaDB".into(),
            source: "detected".into(),
            available: Some(true),
        },
    ]
}

#[tauri::command]
fn get_config_files() -> Vec<ConfigFileSummary> {
    config_files()
}

#[tauri::command]
fn get_config_file(key: String) -> Result<ConfigFileDetail, String> {
    let item = config_files()
        .into_iter()
        .find(|item| item.key == key)
        .ok_or_else(|| "Unknown config key".to_string())?;

    let content = fs::read_to_string(&item.path).map_err(|e| e.to_string())?;

    Ok(ConfigFileDetail {
        key: item.key,
        label: item.label,
        path: item.path,
        content,
    })
}

#[tauri::command]
fn save_config_file(
    key: String,
    content: String,
    reload_service: Option<bool>,
) -> Result<String, String> {
    let item = config_files()
        .into_iter()
        .find(|item| item.key == key)
        .ok_or_else(|| "Unknown config key".to_string())?;

    if Path::new(&item.path).exists() {
        let backup_path = format!("{}.{}.bak", item.path, chrono_like_timestamp());
        fs::copy(&item.path, backup_path).map_err(|e| e.to_string())?;
    }

    fs::write(&item.path, content).map_err(|e| e.to_string())?;

    if reload_service.unwrap_or(false) {
        match item.service_key.as_deref() {
            Some("nginx") => {
                let _ = powershell("& 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'nginx reloaded'");
            }
            Some("php_cgi") => {
                let _ = powershell("Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 500; & 'C:\\Users\\Admin\\Documents\\Codex\\2026-04-23-halo\\start-local-web.ps1'; 'php-cgi restarted'");
            }
            _ => {}
        }
    }

    Ok("Config saved with backup".into())
}

fn chrono_like_timestamp() -> String {
    let script = "Get-Date -Format yyyyMMdd-HHmmss";
    powershell(script).unwrap_or_else(|_| "backup".into())
}

fn is_protected_process_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "system"
            | "registry"
            | "secure system"
            | "smss"
            | "csrss"
            | "wininit"
            | "services"
            | "lsass"
            | "winlogon"
            | "fontdrvhost"
            | "sihost"
            | "dwm"
    )
}

#[tauri::command]
fn get_logs() -> Vec<LogTarget> {
    let targets = vec![
        (
            "nginx_error",
            "nginx error.log",
            "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\logs\\error.log",
        ),
        ("vite_dev", "RhinoBOX vite-dev.log", "C:\\www\\rhinobox\\vite-dev.log"),
        ("phpmyadmin_config", "phpMyAdmin config.inc.php", "C:\\www\\phpmyadmin\\config.inc.php"),
    ];

    targets
        .into_iter()
        .map(|(key, label, path)| LogTarget {
            key: key.into(),
            label: label.into(),
            path: path.into(),
            available: Path::new(path).exists(),
            lines: tail_lines(path, 80),
        })
        .collect()
}

#[tauri::command]
fn get_process_metrics() -> Vec<ProcessMetric> {
    let current_pid = std::process::id();
    let script = format!(
        r#"
$portMap = @{{}}
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Group-Object OwningProcess |
  ForEach-Object {{
    $firstPort = $_.Group | Select-Object -ExpandProperty LocalPort | Sort-Object -Unique | Select-Object -First 1
    if ($null -ne $firstPort) {{
      $portMap[[int]$_.Name] = [int]$firstPort
    }}
  }}

$items = Get-Process -ErrorAction SilentlyContinue | Sort-Object ProcessName, Id | ForEach-Object {{
  $processPath = $null
  try {{ $processPath = $_.Path }} catch {{ $processPath = $null }}

  [pscustomobject]@{{
    key = [string]$_.Id
    label = $_.ProcessName
    status = 'running'
    pid = $_.Id
    port = if ($portMap.ContainsKey($_.Id)) {{ $portMap[$_.Id] }} else {{ $null }}
    memory_mb = [math]::Round($_.WorkingSet64 / 1MB, 1)
    cpu_seconds = if ($null -ne $_.CPU) {{ [math]::Round($_.CPU, 1) }} else {{ $null }}
    kind = 'windows-process'
    path = $processPath
    can_kill = if ($_.Id -in 0, 4, {current_pid}) {{ $false }} else {{ $true }}
  }}
}}

$items | ConvertTo-Json -Depth 4
"#
    );

    let output = powershell(&script).unwrap_or_else(|_| "[]".into());
    let mut items = serde_json::from_str::<Vec<ProcessMetric>>(&output).unwrap_or_default();
    for item in &mut items {
        if is_protected_process_name(&item.label) {
            item.can_kill = false;
        }
    }
    items
}

#[tauri::command]
fn set_service_version(key: String, version: String) -> Result<String, String> {
    let available = service_versions(&key);
    if !available.iter().any(|item| item == &version) {
        return Err("Version is not installed".into());
    }
    set_selected_service_version(&key, &version)?;
    Ok(format!("{key} version set to {version}"))
}

#[tauri::command]
fn control_service(key: String, action: String, version: Option<String>) -> Result<String, String> {
    let chosen_version = version.or_else(|| get_selected_service_version(&key));

    match (key.as_str(), action.as_str()) {
        ("nginx", "start") => {
            let version = chosen_version.unwrap_or_else(|| "1.29.8".into());
            set_selected_service_version("nginx", &version)?;
            let root = nginx_version_path(&version).ok_or_else(|| "Unknown nginx version".to_string())?;
            let exe = format!("{root}\\nginx.exe");
            let script = format!(
                "Start-Process -FilePath '{exe}' -ArgumentList '-p', '{root}\\' -WorkingDirectory '{root}' -WindowStyle Hidden; 'nginx {version} started'"
            );
            powershell(&script)
        }
        ("nginx", "stop") => powershell("Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force; 'nginx stopped'"),
        ("nginx", "reload") => {
            let version = chosen_version.unwrap_or_else(|| "1.29.8".into());
            set_selected_service_version("nginx", &version)?;
            let root = nginx_version_path(&version).ok_or_else(|| "Unknown nginx version".to_string())?;
            let exe = format!("{root}\\nginx.exe");
            let script = format!("Set-Location '{root}'; & '{exe}' -p '{root}\\' -s reload; 'nginx {version} reloaded'");
            powershell(&script)
        }
        ("nginx", "restart") => {
            let version = chosen_version.unwrap_or_else(|| "1.29.8".into());
            set_selected_service_version("nginx", &version)?;
            let root = nginx_version_path(&version).ok_or_else(|| "Unknown nginx version".to_string())?;
            let exe = format!("{root}\\nginx.exe");
            let script = format!(
                "Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 400; Start-Process -FilePath '{exe}' -ArgumentList '-p', '{root}\\' -WorkingDirectory '{root}' -WindowStyle Hidden; 'nginx {version} restarted'"
            );
            powershell(&script)
        }
        ("php_cgi", "start") => {
            let version = chosen_version.unwrap_or_else(|| "8.4.20".into());
            set_selected_service_version("php_cgi", &version)?;
            let root = php_version_path(&version).ok_or_else(|| "Unknown PHP version".to_string())?;
            let exe = format!("{root}\\php-cgi.exe");
            let ini = format!("{root}\\php.ini");
            let script = format!(
                "Start-Process -FilePath '{exe}' -ArgumentList '-c', '{ini}', '-b', '127.0.0.1:9000' -WorkingDirectory '{root}' -WindowStyle Hidden; 'php-cgi {version} started'"
            );
            powershell(&script)
        }
        ("php_cgi", "stop") => powershell("Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; 'php-cgi stopped'"),
        ("php_cgi", "restart") => {
            let version = chosen_version.unwrap_or_else(|| "8.4.20".into());
            set_selected_service_version("php_cgi", &version)?;
            let root = php_version_path(&version).ok_or_else(|| "Unknown PHP version".to_string())?;
            let exe = format!("{root}\\php-cgi.exe");
            let ini = format!("{root}\\php.ini");
            let script = format!(
                "Get-Process php-cgi -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 500; Start-Process -FilePath '{exe}' -ArgumentList '-c', '{ini}', '-b', '127.0.0.1:9000' -WorkingDirectory '{root}' -WindowStyle Hidden; 'php-cgi {version} restarted'"
            );
            powershell(&script)
        }
        ("mariadb", "start") => powershell("Start-Service -Name 'MariaDB'; 'MariaDB started'"),
        ("mariadb", "stop") => powershell("Stop-Service -Name 'MariaDB' -Force; 'MariaDB stopped'"),
        ("mariadb", "restart") => powershell("Restart-Service -Name 'MariaDB' -Force; 'MariaDB restarted'"),
        _ => Err("Unsupported service action".into()),
    }
}

#[tauri::command]
fn open_external(url: String) -> Result<String, String> {
    Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok("Opened external link".into())
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<String, String> {
    if pid == 0 || pid == 4 || pid == std::process::id() {
        return Err("Refusing to kill a protected process".into());
    }

    let check_script = format!(
        r#"$proc = Get-Process -Id {pid} -ErrorAction SilentlyContinue; if ($null -eq $proc) {{ '' }} else {{ $proc.ProcessName }}"#
    );
    let process_name = powershell(&check_script)?;
    if process_name.is_empty() {
        return Err("Process not found".into());
    }
    if is_protected_process_name(&process_name) {
        return Err("Refusing to kill a protected Windows process".into());
    }

    let pid_text = pid.to_string();
    command_output("taskkill", &["/PID", &pid_text, "/F"])?;
    Ok(format!("Process {process_name} ({pid}) terminated"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.ico")) {
                    let _ = window.set_icon(icon);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_services,
            get_discovery,
            get_config_files,
            get_config_file,
            save_config_file,
            get_logs,
            get_process_metrics,
            set_service_version,
            control_service,
            open_external,
            kill_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
