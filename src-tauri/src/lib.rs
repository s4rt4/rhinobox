use serde::{Deserialize, Serialize};
use once_cell::sync::Lazy;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    path::Path,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
        Mutex,
    },
    thread,
    time::Instant,
};
use sysinfo::{Disks, Networks, System};
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

const SERVICE_SELECTION_FILE: &str = "C:\\www\\rhinobox\\service-selection.json";
const VHOSTS_FILE: &str = "C:\\www\\rhinobox\\virtual-hosts.json";
const VHOSTS_DIR: &str = "C:\\www\\rhinobox\\config\\nginx\\vhosts";
const MAILPIT_VERSION: &str = "1.29.7";
const MAILPIT_EXE: &str = "C:\\www\\runtimes\\mailpit\\1.29.7\\mailpit.exe";
const PGWEB_VERSION: &str = "0.16.2";
const PGWEB_EXE: &str = "C:\\www\\runtimes\\pgweb\\0.16.2\\pgweb.exe";
const REDIS_VERSION: &str = "8.6.2";
const REDIS_EXE: &str = "C:\\www\\runtimes\\redis\\8.6.2\\Redis-8.6.2-Windows-x64-msys2\\redis-server.exe";
const REDIS_CONF: &str = "redis-rhinobox.conf";
const MEMCACHED_VERSION: &str = "lite";
const MEMCACHED_PORT: u16 = 11211;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
enum ServiceStatus {
    Running,
    Stopped,
    Unknown,
}

#[derive(Serialize, Clone)]
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

#[derive(Serialize, Deserialize, Clone, Default)]
struct VirtualHostRecord {
    name: String,
    domain: String,
    root: String,
    tld: String,
}

#[derive(Serialize, Clone)]
struct VirtualHostSummary {
    name: String,
    domain: String,
    root: String,
    tld: String,
    config_path: String,
    config_exists: bool,
    hosts_enabled: bool,
}

#[derive(Serialize, Deserialize, Default)]
struct ServiceSelectionState {
    nginx: Option<String>,
    php_cgi: Option<String>,
    mariadb: Option<String>,
    postgresql: Option<String>,
    nodejs: Option<String>,
    mailpit: Option<String>,
    pgweb: Option<String>,
    redis: Option<String>,
    memcached: Option<String>,
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

#[derive(Serialize, Deserialize, Default)]
struct SystemMetrics {
    cpu_percent: Option<f64>,
    memory_used_gb: Option<f64>,
    memory_total_gb: Option<f64>,
    disk_used_gb: Option<f64>,
    disk_total_gb: Option<f64>,
    download_kbps: Option<f64>,
    upload_kbps: Option<f64>,
}

#[derive(Clone, Copy)]
struct NetworkSnapshot {
    timestamp: Instant,
    received_bytes: u64,
    transmitted_bytes: u64,
}

#[derive(Clone)]
struct ServiceSnapshot {
    timestamp: Instant,
    services: Vec<ManagedService>,
}

#[derive(Clone)]
struct RuntimeDiscoverySnapshot {
    timestamp: Instant,
    nginx_versions: Vec<String>,
    php_versions: Vec<String>,
    mariadb_versions: Vec<String>,
    postgresql_versions: Vec<String>,
    node_versions: Vec<String>,
    node_version_paths: Vec<(String, String)>,
    python_path: Option<String>,
    python_version: Option<String>,
    go_path: Option<String>,
    go_version: Option<String>,
    postgresql_path: Option<String>,
    git_path: Option<String>,
    git_version: Option<String>,
    mailpit_path: Option<String>,
    pgweb_path: Option<String>,
    redis_path: Option<String>,
}

static NETWORK_SNAPSHOT: Lazy<Mutex<Option<NetworkSnapshot>>> = Lazy::new(|| Mutex::new(None));
static SERVICE_SNAPSHOT: Lazy<Mutex<Option<ServiceSnapshot>>> = Lazy::new(|| Mutex::new(None));
static RUNTIME_DISCOVERY_SNAPSHOT: Lazy<Mutex<Option<RuntimeDiscoverySnapshot>>> =
    Lazy::new(|| Mutex::new(None));
static MEMCACHED_LITE: Lazy<MemcachedLiteState> = Lazy::new(MemcachedLiteState::default);

#[derive(Default)]
struct MemcachedLiteState {
    running: AtomicBool,
    store: Arc<Mutex<HashMap<String, Vec<u8>>>>,
}

#[derive(Default)]
struct AppLifecycleState {
    allow_exit: AtomicBool,
}

fn show_main_window<R: tauri::Runtime, M: Manager<R>>(manager: &M) {
    if let Some(window) = manager.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn new_background_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn powershell(script: &str) -> Result<String, String> {
    let output = new_background_command("powershell")
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
    let output = new_background_command(program)
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

fn invalidate_service_snapshot() {
    if let Ok(mut snapshot) = SERVICE_SNAPSHOT.lock() {
        *snapshot = None;
    }
}

fn runtime_discovery_snapshot() -> RuntimeDiscoverySnapshot {
    if let Ok(snapshot) = RUNTIME_DISCOVERY_SNAPSHOT.lock() {
        if let Some(snapshot) = snapshot.as_ref() {
            if snapshot.timestamp.elapsed().as_secs_f64() < 180.0 {
                return snapshot.clone();
            }
        }
    }

    let node_version_paths = node_versions_with_paths();
    let snapshot = RuntimeDiscoverySnapshot {
        timestamp: Instant::now(),
        nginx_versions: installed_nginx_versions(),
        php_versions: installed_php_versions(),
        mariadb_versions: vec!["12.2.2".into()],
        postgresql_versions: postgresql_bin_path()
            .and_then(|path| command_version(&path, &["--version"]))
            .map(|version| version.replace("psql (PostgreSQL)", "").trim().to_string())
            .into_iter()
            .collect(),
        node_versions: node_version_paths.iter().map(|(version, _)| version.clone()).collect(),
        node_version_paths,
        python_path: command_exists_path("python"),
        python_version: command_version("python", &["--version"]),
        go_path: command_exists_path("go"),
        go_version: command_version("go", &["version"]),
        postgresql_path: postgresql_bin_path(),
        git_path: command_exists_path("git").or_else(|| {
            let primary = "C:\\Program Files\\Git\\cmd\\git.exe".to_string();
            if Path::new(&primary).exists() {
                Some(primary)
            } else {
                None
            }
        }),
        git_version: command_version("git", &["--version"]),
        mailpit_path: if Path::new(MAILPIT_EXE).exists() {
            Some(MAILPIT_EXE.to_string())
        } else {
            command_exists_path("mailpit")
        },
        pgweb_path: if Path::new(PGWEB_EXE).exists() {
            Some(PGWEB_EXE.to_string())
        } else {
            command_exists_path("pgweb")
        },
        redis_path: if Path::new(REDIS_EXE).exists() {
            Some(REDIS_EXE.to_string())
        } else {
            command_exists_path("redis-server")
        },
    };

    if let Ok(mut cached) = RUNTIME_DISCOVERY_SNAPSHOT.lock() {
        *cached = Some(snapshot.clone());
    }

    snapshot
}

fn installed_status(path: Option<&String>) -> ServiceStatus {
    if path.is_some() {
        ServiceStatus::Running
    } else {
        ServiceStatus::Stopped
    }
}

fn memcached_lite_running() -> bool {
    MEMCACHED_LITE.running.load(Ordering::SeqCst)
}

fn handle_memcached_client(stream: TcpStream, store: Arc<Mutex<HashMap<String, Vec<u8>>>>) {
    let reader_stream = match stream.try_clone() {
        Ok(stream) => stream,
        Err(_) => return,
    };
    let mut reader = BufReader::new(reader_stream);
    let mut writer = stream;

    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }

        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        match parts.first().map(|part| part.to_ascii_lowercase()).as_deref() {
            Some("get") => {
                for key in parts.iter().skip(1) {
                    let value = store.lock().ok().and_then(|items| items.get(*key).cloned());
                    if let Some(value) = value {
                        let _ = write!(writer, "VALUE {} 0 {}\r\n", key, value.len());
                        let _ = writer.write_all(&value);
                        let _ = writer.write_all(b"\r\n");
                    }
                }
                let _ = writer.write_all(b"END\r\n");
            }
            Some("set") => {
                if parts.len() < 5 {
                    let _ = writer.write_all(b"CLIENT_ERROR bad command line format\r\n");
                    continue;
                }

                let key = parts[1].to_string();
                let Ok(bytes) = parts[4].parse::<usize>() else {
                    let _ = writer.write_all(b"CLIENT_ERROR bad data chunk\r\n");
                    continue;
                };

                let mut value = vec![0_u8; bytes];
                if reader.read_exact(&mut value).is_err() {
                    break;
                }
                let mut crlf = [0_u8; 2];
                let _ = reader.read_exact(&mut crlf);

                if let Ok(mut items) = store.lock() {
                    items.insert(key, value);
                }
                if !parts.iter().any(|part| part.eq_ignore_ascii_case("noreply")) {
                    let _ = writer.write_all(b"STORED\r\n");
                }
            }
            Some("delete") => {
                if let Some(key) = parts.get(1) {
                    let removed = store
                        .lock()
                        .map(|mut items| items.remove(*key).is_some())
                        .unwrap_or(false);
                    let _ = if removed {
                        writer.write_all(b"DELETED\r\n")
                    } else {
                        writer.write_all(b"NOT_FOUND\r\n")
                    };
                } else {
                    let _ = writer.write_all(b"CLIENT_ERROR bad command line format\r\n");
                }
            }
            Some("flush_all") => {
                if let Ok(mut items) = store.lock() {
                    items.clear();
                }
                let _ = writer.write_all(b"OK\r\n");
            }
            Some("version") => {
                let _ = writer.write_all(b"VERSION RhinoBOX Memcached Lite\r\n");
            }
            Some("quit") => break,
            _ => {
                let _ = writer.write_all(b"ERROR\r\n");
            }
        }
    }
}

fn start_memcached_lite() -> Result<String, String> {
    if memcached_lite_running() {
        return Ok("Memcached Lite already running".into());
    }

    let listener = TcpListener::bind(("127.0.0.1", MEMCACHED_PORT))
        .map_err(|e| format!("Memcached port {MEMCACHED_PORT} unavailable: {e}"))?;
    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;

    MEMCACHED_LITE.running.store(true, Ordering::SeqCst);
    let store = Arc::clone(&MEMCACHED_LITE.store);

    thread::spawn(move || {
        for stream in listener.incoming() {
            if !MEMCACHED_LITE.running.load(Ordering::SeqCst) {
                break;
            }

            if let Ok(stream) = stream {
                let store = Arc::clone(&store);
                thread::spawn(move || handle_memcached_client(stream, store));
            }
        }
    });

    Ok("Memcached Lite started".into())
}

fn stop_memcached_lite() -> Result<String, String> {
    if !memcached_lite_running() {
        return Ok("Memcached Lite stopped".into());
    }

    MEMCACHED_LITE.running.store(false, Ordering::SeqCst);
    if let Ok(mut items) = MEMCACHED_LITE.store.lock() {
        items.clear();
    }
    let _ = TcpStream::connect(("127.0.0.1", MEMCACHED_PORT));
    Ok("Memcached Lite stopped".into())
}

fn parse_tasklist_row(line: &str) -> Option<(String, u32)> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let parts: Vec<&str> = trimmed.split("\",\"").collect();
    if parts.len() < 2 {
        return None;
    }

    let image = parts.first()?.trim_matches('"').to_string();
    let pid = parts.get(1)?.trim_matches('"').parse::<u32>().ok()?;
    Some((image, pid))
}

fn process_id_map() -> HashMap<String, u32> {
    command_output("tasklist", &["/FO", "CSV", "/NH"])
        .ok()
        .map(|output| {
            output
                .lines()
                .filter_map(parse_tasklist_row)
                .fold(HashMap::new(), |mut acc, (image, pid)| {
                    acc.entry(image.to_ascii_lowercase()).or_insert(pid);
                    acc
                })
        })
        .unwrap_or_default()
}

fn parse_listening_ports(output: &str) -> HashSet<u16> {
    output
        .lines()
        .filter(|line| line.to_ascii_uppercase().contains("LISTENING"))
        .filter_map(|line| {
            line.split_whitespace().nth(1).and_then(|local| {
                local
                    .rsplit(':')
                    .next()
                    .and_then(|port| port.parse::<u16>().ok())
            })
        })
        .collect()
}

fn listening_ports() -> HashSet<u16> {
    command_output("netstat", &["-ano", "-p", "tcp"])
        .ok()
        .map(|output| parse_listening_ports(&output))
        .unwrap_or_default()
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
        ConfigFileSummary {
            key: "mariadb".into(),
            label: "my.ini".into(),
            path: "C:\\Program Files\\MariaDB 12.2\\data\\my.ini".into(),
            service_key: Some("mariadb".into()),
            exists: Some(Path::new("C:\\Program Files\\MariaDB 12.2\\data\\my.ini").exists()),
        },
        ConfigFileSummary {
            key: "phpmyadmin".into(),
            label: "config.inc.php".into(),
            path: "C:\\www\\phpmyadmin\\config.inc.php".into(),
            service_key: None,
            exists: Some(Path::new("C:\\www\\phpmyadmin\\config.inc.php").exists()),
        },
        ConfigFileSummary {
            key: "postgresql".into(),
            label: "postgresql.conf".into(),
            path: "C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf".into(),
            service_key: Some("postgresql".into()),
            exists: Some(Path::new("C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf").exists()),
        },
        ConfigFileSummary {
            key: "postgresql_hba".into(),
            label: "pg_hba.conf".into(),
            path: "C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf".into(),
            service_key: Some("postgresql".into()),
            exists: Some(Path::new("C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf").exists()),
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
        "postgresql" => state.postgresql,
        "nodejs" => state.nodejs,
        "mailpit" => state.mailpit,
        "pgweb" => state.pgweb,
        "redis" => state.redis,
        "memcached" => state.memcached,
        _ => None,
    }
}

fn set_selected_service_version(key: &str, version: &str) -> Result<(), String> {
    let mut state = read_service_selection_state();
    match key {
        "nginx" => state.nginx = Some(version.to_string()),
        "php_cgi" => state.php_cgi = Some(version.to_string()),
        "mariadb" => state.mariadb = Some(version.to_string()),
        "postgresql" => state.postgresql = Some(version.to_string()),
        "nodejs" => state.nodejs = Some(version.to_string()),
        "mailpit" => state.mailpit = Some(version.to_string()),
        "pgweb" => state.pgweb = Some(version.to_string()),
        "redis" => state.redis = Some(version.to_string()),
        "memcached" => state.memcached = Some(version.to_string()),
        _ => return Err("Unknown service key".into()),
    }
    write_service_selection_state(&state)
}

fn sanitize_vhost_name(name: &str) -> Result<String, String> {
    let normalized = name
        .trim()
        .trim_end_matches(".test")
        .trim_end_matches(".local")
        .to_ascii_lowercase();
    if normalized.is_empty()
        || normalized.len() > 63
        || !normalized
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
        || normalized.starts_with('-')
        || normalized.ends_with('-')
    {
        return Err("Use a simple project name like myapp or client-site".into());
    }
    Ok(normalized)
}

fn sanitize_vhost_tld(tld: &str) -> Result<String, String> {
    let normalized = tld.trim().trim_start_matches('.').to_ascii_lowercase();
    match normalized.as_str() {
        "test" | "local" => Ok(normalized),
        _ => Err("Only .test and .local are supported".into()),
    }
}

fn vhost_config_path(domain: &str) -> String {
    format!("{VHOSTS_DIR}\\{domain}.conf")
}

fn read_virtual_host_records() -> Vec<VirtualHostRecord> {
    fs::read_to_string(VHOSTS_FILE)
        .ok()
        .and_then(|content| serde_json::from_str::<Vec<VirtualHostRecord>>(&content).ok())
        .unwrap_or_default()
}

fn write_virtual_host_records(records: &[VirtualHostRecord]) -> Result<(), String> {
    if let Some(parent) = Path::new(VHOSTS_FILE).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(records).map_err(|e| e.to_string())?;
    fs::write(VHOSTS_FILE, content).map_err(|e| e.to_string())
}

fn hosts_file_path() -> &'static str {
    "C:\\Windows\\System32\\drivers\\etc\\hosts"
}

fn hosts_contains_domain(domain: &str) -> bool {
    fs::read_to_string(hosts_file_path())
        .map(|content| {
            content
                .lines()
                .any(|line| !line.trim_start().starts_with('#') && line.split_whitespace().any(|part| part.eq_ignore_ascii_case(domain)))
        })
        .unwrap_or(false)
}

fn update_hosts_direct(domain: &str, add: bool) -> Result<(), String> {
    let path = hosts_file_path();
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content
        .lines()
        .filter(|line| {
            if add {
                true
            } else {
                !(line.contains("# RhinoBOX") && line.split_whitespace().any(|part| part.eq_ignore_ascii_case(domain)))
            }
        })
        .map(|line| line.to_string())
        .collect();

    if add && !hosts_contains_domain(domain) {
        lines.push(format!("127.0.0.1 {domain} # RhinoBOX"));
    }

    let mut next = lines.join("\r\n");
    next.push_str("\r\n");
    fs::write(path, next).map_err(|e| e.to_string())
}

fn update_hosts_elevated(domain: &str, add: bool) -> Result<(), String> {
    let safe_domain = domain.replace('\'', "''");
    let script = if add {
        format!(
            "$hosts = '{path}'; $domain = '{safe_domain}'; $line = \"127.0.0.1 $domain # RhinoBOX\"; $content = Get-Content -LiteralPath $hosts -ErrorAction Stop; if (-not ($content -match \"\\s$([regex]::Escape($domain))(\\s|$)\")) {{ Add-Content -LiteralPath $hosts -Value $line }}",
            path = hosts_file_path()
        )
    } else {
        format!(
            "$hosts = '{path}'; $domain = '{safe_domain}'; $content = Get-Content -LiteralPath $hosts -ErrorAction Stop; $next = $content | Where-Object {{ -not (($_ -like '*# RhinoBOX*') -and ($_ -match \"\\s$([regex]::Escape($domain))(\\s|$)\")) }}; Set-Content -LiteralPath $hosts -Value $next",
            path = hosts_file_path()
        )
    };

    let encoded = {
        let mut bytes = Vec::new();
        for unit in script.encode_utf16() {
            bytes.extend(unit.to_le_bytes());
        }
        base64_encode(&bytes)
    };

    new_background_command("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &format!("Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand {encoded}'"),
        ])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn update_hosts(domain: &str, add: bool) -> Result<String, String> {
    match update_hosts_direct(domain, add) {
        Ok(()) => Ok("hosts file updated".into()),
        Err(_) => {
            update_hosts_elevated(domain, add)?;
            Ok("hosts update needs Windows admin approval".into())
        }
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let b0 = bytes[index];
        let b1 = *bytes.get(index + 1).unwrap_or(&0);
        let b2 = *bytes.get(index + 2).unwrap_or(&0);
        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if index + 1 < bytes.len() {
            output.push(TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if index + 2 < bytes.len() {
            output.push(TABLE[(b2 & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }
        index += 3;
    }
    output
}

fn normalize_nginx_path(path: &str) -> String {
    path.replace('\\', "/")
}

fn vhost_nginx_config(domain: &str, root: &str) -> String {
    let root = normalize_nginx_path(root);
    format!(
        "server {{\n    listen 80;\n    server_name {domain};\n    root {root};\n    index index.php index.html index.htm;\n\n    location / {{\n        try_files $uri $uri/ /index.php?$query_string;\n    }}\n\n    location ~ \\.php$ {{\n        include fastcgi_params;\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        fastcgi_pass 127.0.0.1:9000;\n    }}\n}}\n"
    )
}

fn ensure_nginx_vhost_include() -> Result<(), String> {
    fs::create_dir_all(VHOSTS_DIR).map_err(|e| e.to_string())?;
    let include_line = "include C:/www/rhinobox/config/nginx/vhosts/*.conf;";

    for version in installed_nginx_versions() {
        let Some(root) = nginx_version_path(&version) else {
            continue;
        };
        let config_path = format!("{root}\\conf\\nginx.conf");
        let Ok(content) = fs::read_to_string(&config_path) else {
            continue;
        };
        if content.contains(include_line) {
            continue;
        }

        let insert = format!("    {include_line}\n");
        let next = if let Some(index) = content.rfind("\n}") {
            let (head, tail) = content.split_at(index + 1);
            format!("{head}{insert}{tail}")
        } else {
            format!("{content}\n{insert}")
        };
        fs::write(&config_path, next).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn list_virtual_hosts_inner() -> Vec<VirtualHostSummary> {
    read_virtual_host_records()
        .into_iter()
        .map(|record| {
            let config_path = vhost_config_path(&record.domain);
            VirtualHostSummary {
                name: record.name,
                domain: record.domain.clone(),
                root: record.root,
                tld: record.tld,
                config_exists: Path::new(&config_path).exists(),
                hosts_enabled: hosts_contains_domain(&record.domain),
                config_path,
            }
        })
        .collect()
}

fn create_virtual_host_inner(name: String, tld: String, root: String) -> Result<String, String> {
    let name = sanitize_vhost_name(&name)?;
    let tld = sanitize_vhost_tld(&tld)?;
    let root = if root.trim().is_empty() {
        format!("C:\\www\\{name}")
    } else {
        root.trim().to_string()
    };
    let domain = format!("{name}.{tld}");

    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let index_path = format!("{root}\\index.php");
    if !Path::new(&index_path).exists() {
        fs::write(&index_path, format!("<?php\nphpinfo();\n// {domain}\n")).map_err(|e| e.to_string())?;
    }

    fs::create_dir_all(VHOSTS_DIR).map_err(|e| e.to_string())?;
    fs::write(vhost_config_path(&domain), vhost_nginx_config(&domain, &root)).map_err(|e| e.to_string())?;
    ensure_nginx_vhost_include()?;

    let mut records = read_virtual_host_records();
    records.retain(|record| record.domain != domain);
    records.push(VirtualHostRecord {
        name,
        domain: domain.clone(),
        root,
        tld,
    });
    records.sort_by(|left, right| left.domain.cmp(&right.domain));
    write_virtual_host_records(&records)?;

    let hosts_message = update_hosts(&domain, true)?;
    invalidate_service_snapshot();
    Ok(format!("{domain} created; {hosts_message}; restart nginx to apply"))
}

fn remove_virtual_host_inner(domain: String) -> Result<String, String> {
    let domain = domain.trim().to_ascii_lowercase();
    if domain.is_empty() {
        return Err("Domain is required".into());
    }

    let config_path = vhost_config_path(&domain);
    if Path::new(&config_path).exists() {
        fs::remove_file(&config_path).map_err(|e| e.to_string())?;
    }

    let mut records = read_virtual_host_records();
    records.retain(|record| record.domain != domain);
    write_virtual_host_records(&records)?;

    let hosts_message = update_hosts(&domain, false)?;
    invalidate_service_snapshot();
    Ok(format!("{domain} removed; {hosts_message}; restart nginx to apply"))
}

fn node_version_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    let primary = "C:\\Program Files\\nodejs\\node.exe";
    if Path::new(primary).exists() {
        candidates.push(primary.to_string());
    }

    let nvm_root = std::env::var("NVM_HOME")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|local| format!("{local}\\nvm"))
        })
        .unwrap_or_else(|| "C:\\Program Files\\nvm".to_string());

    if let Ok(entries) = fs::read_dir(&nvm_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !(name.starts_with('v') || name.chars().next().is_some_and(|ch| ch.is_ascii_digit())) {
                continue;
            }
            let exe = path.join("node.exe");
            if exe.exists() {
                candidates.push(exe.to_string_lossy().to_string());
            }
        }
    }

    candidates.sort();
    candidates.dedup();
    candidates
}

fn node_versions_with_paths() -> Vec<(String, String)> {
    let mut versions: Vec<(String, String)> = node_version_candidates()
        .into_iter()
        .filter_map(|path| {
            command_version(&path, &["-v"]).map(|version| (version.trim_start_matches('v').to_string(), path))
        })
        .collect();
    versions.sort_by(|a, b| a.0.cmp(&b.0));
    versions.dedup_by(|a, b| a.0 == b.0);
    versions
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

fn postgresql_service_name() -> String {
    "postgresql-x64-17".into()
}

fn postgresql_bin_path() -> Option<String> {
    let path = "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe".to_string();
    if Path::new(&path).exists() {
        Some(path)
    } else {
        command_exists_path("psql")
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
        "postgresql" => postgresql_bin_path()
            .and_then(|path| command_version(&path, &["--version"]))
            .map(|version| {
                version
                    .replace("psql (PostgreSQL)", "")
                    .trim()
                    .to_string()
            })
            .into_iter()
            .collect(),
        "nodejs" => node_versions_with_paths()
            .into_iter()
            .map(|(version, _)| version)
            .collect(),
        "mailpit" => vec![MAILPIT_VERSION.into()],
        "pgweb" => vec![PGWEB_VERSION.into()],
        "redis" => vec![REDIS_VERSION.into()],
        "memcached" => vec![MEMCACHED_VERSION.into()],
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

fn latest_matching_file(dir: &str, prefix: &str, suffix: &str) -> Option<String> {
    let mut latest: Option<(std::time::SystemTime, String)> = None;
    let entries = fs::read_dir(dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with(prefix) || !name.ends_with(suffix) {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

        let full_path = path.to_string_lossy().to_string();
        match &latest {
            Some((current_modified, _)) if *current_modified >= modified => {}
            _ => latest = Some((modified, full_path)),
        }
    }

    latest.map(|(_, path)| path)
}

fn get_services_inner() -> Vec<ManagedService> {
    if let Ok(snapshot) = SERVICE_SNAPSHOT.lock() {
        if let Some(snapshot) = snapshot.as_ref() {
            if snapshot.timestamp.elapsed().as_secs_f64() < 4.0 {
                return snapshot.services.clone();
            }
        }
    }

    let discovery = runtime_discovery_snapshot();
    let nginx_versions = discovery.nginx_versions.clone();
    let php_versions = discovery.php_versions.clone();
    let mariadb_versions = discovery.mariadb_versions.clone();
    let postgresql_versions = discovery.postgresql_versions.clone();
    let node_versions = discovery.node_versions.clone();
    let nginx_current = get_selected_service_version("nginx")
        .or_else(|| nginx_versions.first().cloned());
    let php_current = get_selected_service_version("php_cgi")
        .or_else(|| php_versions.iter().find(|version| version.as_str() == "8.4.20").cloned())
        .or_else(|| php_versions.first().cloned());
    let mariadb_current = get_selected_service_version("mariadb")
        .or_else(|| mariadb_versions.first().cloned());
    let postgresql_current = get_selected_service_version("postgresql")
        .or_else(|| postgresql_versions.first().cloned());
    let node_current = get_selected_service_version("nodejs")
        .or_else(|| node_versions.first().cloned());
    let node_path = node_current
        .as_deref()
        .and_then(|version| {
            discovery
                .node_version_paths
                .iter()
                .find(|(found_version, _)| found_version == version)
                .map(|(_, path)| path.clone())
        })
        .or_else(|| discovery.node_version_paths.first().map(|(_, path)| path.clone()));
    let python_path = discovery.python_path.clone();
    let go_path = discovery.go_path.clone();
    let postgresql_service = postgresql_service_name();
    let postgresql_path = discovery.postgresql_path.clone();
    let git_path = discovery.git_path.clone();
    let mailpit_path = discovery.mailpit_path.clone();
    let pgweb_path = discovery.pgweb_path.clone();
    let redis_path = discovery.redis_path.clone();
    let ports = listening_ports();
    let localhost_ready = ports.contains(&80);
    let phpmyadmin_ready = localhost_ready && ports.contains(&9000);
    let processes = process_id_map();
    let nginx_pid = processes.get("nginx.exe").copied();
    let php_cgi_pid = processes.get("php-cgi.exe").copied();
    let mariadb_pid = processes.get("mariadb.exe").copied();
    let postgres_pid = processes.get("postgres.exe").copied();
    let node_pid = processes.get("node.exe").copied();
    let python_pid = processes.get("python.exe").copied();
    let go_pid = processes.get("go.exe").copied();
    let git_pid = processes.get("git.exe").copied();
    let mailpit_pid = processes.get("mailpit.exe").copied();
    let pgweb_pid = processes.get("pgweb.exe").copied();
    let redis_pid = processes.get("redis-server.exe").copied();
    let memcached_running = memcached_lite_running() || ports.contains(&MEMCACHED_PORT);

    let services = vec![
        ManagedService {
            key: "nginx".into(),
            label: "nginx".into(),
            status: if nginx_pid.is_some() { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Web server for localhost and phpMyAdmin".into(),
            port: Some(80),
            pid: nginx_pid,
            can_reload: true,
            kind: "process".into(),
            current_version: nginx_current,
            versions: nginx_versions,
            launch_target: None,
        },
        ManagedService {
            key: "php_cgi".into(),
            label: "PHP-CGI".into(),
            status: if php_cgi_pid.is_some() { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "FastCGI bridge for PHP requests".into(),
            port: if ports.contains(&9000) { Some(9000) } else { None },
            pid: php_cgi_pid,
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
            port: if ports.contains(&3306) { Some(3306) } else { None },
            pid: mariadb_pid,
            can_reload: false,
            kind: "windows-service".into(),
            current_version: mariadb_current,
            versions: mariadb_versions,
            launch_target: None,
        },
        ManagedService {
            key: "postgresql".into(),
            label: "PostgreSQL".into(),
            status: windows_service_status(&postgresql_service),
            detail: "Primary PostgreSQL database service".into(),
            port: if ports.contains(&5432) { Some(5432) } else { None },
            pid: postgres_pid,
            can_reload: false,
            kind: "windows-service".into(),
            current_version: postgresql_current,
            versions: postgresql_versions,
            launch_target: postgresql_path,
        },
        ManagedService {
            key: "mailpit".into(),
            label: "Mailpit".into(),
            status: if mailpit_pid.is_some() { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Local SMTP catcher and mail inbox".into(),
            port: if ports.contains(&8025) { Some(8025) } else { None },
            pid: mailpit_pid,
            can_reload: false,
            kind: "process".into(),
            current_version: Some(MAILPIT_VERSION.into()),
            versions: vec![MAILPIT_VERSION.into()],
            launch_target: mailpit_path,
        },
        ManagedService {
            key: "pgweb".into(),
            label: "Pgweb".into(),
            status: if pgweb_pid.is_some() { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Lightweight PostgreSQL web client".into(),
            port: if ports.contains(&8081) { Some(8081) } else { None },
            pid: pgweb_pid,
            can_reload: false,
            kind: "process".into(),
            current_version: Some(PGWEB_VERSION.into()),
            versions: vec![PGWEB_VERSION.into()],
            launch_target: pgweb_path,
        },
        ManagedService {
            key: "redis".into(),
            label: "Redis".into(),
            status: if redis_pid.is_some() { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "In-memory cache and queue backend".into(),
            port: if ports.contains(&6379) { Some(6379) } else { None },
            pid: redis_pid,
            can_reload: false,
            kind: "process".into(),
            current_version: Some(REDIS_VERSION.into()),
            versions: vec![REDIS_VERSION.into()],
            launch_target: redis_path,
        },
        ManagedService {
            key: "memcached".into(),
            label: "Memcached".into(),
            status: if memcached_running { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Embedded local memory cache for dev".into(),
            port: if memcached_running { Some(MEMCACHED_PORT) } else { None },
            pid: None,
            can_reload: false,
            kind: "process".into(),
            current_version: Some(MEMCACHED_VERSION.into()),
            versions: vec![MEMCACHED_VERSION.into()],
            launch_target: Some(format!("127.0.0.1:{MEMCACHED_PORT}")),
        },
        ManagedService {
            key: "localhost".into(),
            label: "Localhost".into(),
            status: if localhost_ready { ServiceStatus::Running } else { ServiceStatus::Stopped },
            detail: "Landing page lokal untuk stack web kamu".into(),
            port: if localhost_ready { Some(80) } else { None },
            pid: nginx_pid,
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
            pid: php_cgi_pid,
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
            pid: node_pid,
            can_reload: false,
            kind: "runtime".into(),
            current_version: node_current,
            versions: node_versions,
            launch_target: node_path,
        },
        ManagedService {
            key: "python".into(),
            label: "Python".into(),
            status: installed_status(python_path.as_ref()),
            detail: "Runtime scripting dan automation".into(),
            port: None,
            pid: python_pid,
            can_reload: false,
            kind: "runtime".into(),
            current_version: discovery.python_version.clone(),
            versions: Vec::new(),
            launch_target: python_path,
        },
        ManagedService {
            key: "go".into(),
            label: "Go".into(),
            status: installed_status(go_path.as_ref()),
            detail: "Runtime dan toolchain Go".into(),
            port: None,
            pid: go_pid,
            can_reload: false,
            kind: "runtime".into(),
            current_version: discovery.go_version.clone(),
            versions: Vec::new(),
            launch_target: go_path,
        },
        ManagedService {
            key: "git".into(),
            label: "Git".into(),
            status: installed_status(git_path.as_ref()),
            detail: "Version control tooling".into(),
            port: None,
            pid: git_pid,
            can_reload: false,
            kind: "runtime".into(),
            current_version: discovery.git_version.clone(),
            versions: Vec::new(),
            launch_target: git_path,
        },
    ];

    if let Ok(mut snapshot) = SERVICE_SNAPSHOT.lock() {
        *snapshot = Some(ServiceSnapshot {
            timestamp: Instant::now(),
            services: services.clone(),
        });
    }

    services
}

#[tauri::command]
fn get_discovery() -> Vec<DiscoveryItem> {
    let _ = fs::create_dir_all(VHOSTS_DIR);
    let discovery = runtime_discovery_snapshot();
    let nginx_current = get_selected_service_version("nginx").unwrap_or_else(|| "1.29.8".into());
    let php_current = get_selected_service_version("php_cgi").unwrap_or_else(|| "8.4.20".into());
    let node_current = get_selected_service_version("nodejs")
        .or_else(|| discovery.node_versions.first().cloned());
    let nginx_root = nginx_version_path(&nginx_current).unwrap_or_else(|| {
        "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8".into()
    });
    let php_root = php_version_path(&php_current).unwrap_or_else(|| {
        "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe".into()
    });
    let node_path = node_current
        .as_deref()
        .and_then(|version| {
            discovery
                .node_version_paths
                .iter()
                .find(|(found_version, _)| found_version == version)
                .map(|(_, path)| path.clone())
        })
        .or_else(|| discovery.node_version_paths.first().map(|(_, path)| path.clone()))
        .unwrap_or_else(|| "C:\\Program Files\\nodejs\\node.exe".into());
    let mailpit_path = discovery
        .mailpit_path
        .clone()
        .unwrap_or_else(|| MAILPIT_EXE.into());
    let pgweb_path = discovery
        .pgweb_path
        .clone()
        .unwrap_or_else(|| PGWEB_EXE.into());
    let redis_path = discovery
        .redis_path
        .clone()
        .unwrap_or_else(|| REDIS_EXE.into());

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
            key: "nginx_bin".into(),
            label: "Active nginx binary".into(),
            value: format!("{nginx_root}\\nginx.exe"),
            source: "selected".into(),
            available: Some(Path::new(&format!("{nginx_root}\\nginx.exe")).exists()),
        },
        DiscoveryItem {
            key: "php_ini".into(),
            label: "Active PHP config".into(),
            value: format!("{php_root}\\php.ini"),
            source: "selected".into(),
            available: Some(Path::new(&format!("{php_root}\\php.ini")).exists()),
        },
        DiscoveryItem {
            key: "mariadb_conf".into(),
            label: "MariaDB config".into(),
            value: "C:\\Program Files\\MariaDB 12.2\\data\\my.ini".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Program Files\\MariaDB 12.2\\data\\my.ini").exists()),
        },
        DiscoveryItem {
            key: "mariadb_data".into(),
            label: "MariaDB data dir".into(),
            value: "C:\\Program Files\\MariaDB 12.2\\data".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Program Files\\MariaDB 12.2\\data").exists()),
        },
        DiscoveryItem {
            key: "postgresql_conf".into(),
            label: "PostgreSQL config".into(),
            value: "C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Program Files\\PostgreSQL\\17\\data\\postgresql.conf").exists()),
        },
        DiscoveryItem {
            key: "postgresql_hba".into(),
            label: "PostgreSQL access rules".into(),
            value: "C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Program Files\\PostgreSQL\\17\\data\\pg_hba.conf").exists()),
        },
        DiscoveryItem {
            key: "postgresql_data".into(),
            label: "PostgreSQL data dir".into(),
            value: "C:\\Program Files\\PostgreSQL\\17\\data".into(),
            source: "detected".into(),
            available: Some(Path::new("C:\\Program Files\\PostgreSQL\\17\\data").exists()),
        },
        DiscoveryItem {
            key: "nodejs_path".into(),
            label: "Active Node.js path".into(),
            value: node_path.clone(),
            source: "selected".into(),
            available: Some(Path::new(&node_path).exists()),
        },
        DiscoveryItem {
            key: "mailpit_bin".into(),
            label: "Mailpit binary".into(),
            value: mailpit_path.clone(),
            source: "detected".into(),
            available: Some(Path::new(&mailpit_path).exists()),
        },
        DiscoveryItem {
            key: "pgweb_bin".into(),
            label: "Pgweb binary".into(),
            value: pgweb_path.clone(),
            source: "detected".into(),
            available: Some(Path::new(&pgweb_path).exists()),
        },
        DiscoveryItem {
            key: "redis_bin".into(),
            label: "Redis binary".into(),
            value: redis_path.clone(),
            source: "detected".into(),
            available: Some(Path::new(&redis_path).exists()),
        },
        DiscoveryItem {
            key: "memcached_lite".into(),
            label: "Memcached endpoint".into(),
            value: format!("127.0.0.1:{MEMCACHED_PORT}"),
            source: "embedded".into(),
            available: Some(true),
        },
        DiscoveryItem {
            key: "vhosts_dir".into(),
            label: "Virtual host configs".into(),
            value: VHOSTS_DIR.into(),
            source: "derived".into(),
            available: Some(Path::new(VHOSTS_DIR).exists()),
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
            Some("mariadb") => {
                let _ = powershell("Restart-Service -Name 'MariaDB' -Force; 'MariaDB restarted'");
            }
            Some("postgresql") => {
                let _ = powershell("Restart-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL restarted'");
            }
            _ => {}
        }
    }

    invalidate_service_snapshot();

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
    let postgres_log = latest_matching_file(
        "C:\\Program Files\\PostgreSQL\\17\\data\\log",
        "postgresql-",
        ".log",
    )
    .unwrap_or_else(|| "C:\\Program Files\\PostgreSQL\\17\\data\\log".into());

    let targets = vec![
        (
            "nginx_error".to_string(),
            "nginx error.log".to_string(),
            "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\\nginx-1.29.8\\logs\\error.log".to_string(),
        ),
        (
            "mariadb_error".to_string(),
            "MariaDB error log".to_string(),
            "C:\\Program Files\\MariaDB 12.2\\data\\DESKTOP-SAN5L98.err".to_string(),
        ),
        (
            "postgresql_log".to_string(),
            "PostgreSQL log".to_string(),
            postgres_log,
        ),
    ];

    targets
        .into_iter()
        .map(|(key, label, path)| LogTarget {
            key,
            label,
            available: Path::new(&path).exists(),
            lines: tail_lines(&path, 120),
            path,
        })
        .collect()
}

fn get_process_metrics_inner(detailed: bool) -> Vec<ProcessMetric> {
    let current_pid = std::process::id();
    let script = if detailed {
        format!(
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
        )
    } else {
        format!(
            r#"
$items = Get-Process -ErrorAction SilentlyContinue | Sort-Object ProcessName, Id | ForEach-Object {{
  [pscustomobject]@{{
    key = [string]$_.Id
    label = $_.ProcessName
    status = 'running'
    pid = $_.Id
    port = $null
    memory_mb = [math]::Round($_.WorkingSet64 / 1MB, 1)
    cpu_seconds = $null
    kind = 'windows-process'
    path = $null
    can_kill = if ($_.Id -in 0, 4, {current_pid}) {{ $false }} else {{ $true }}
  }}
}}

$items | ConvertTo-Json -Depth 4
"#
        )
    };

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
fn get_system_metrics() -> SystemMetrics {
    let mut system = System::new_all();
    system.refresh_cpu_usage();
    system.refresh_memory();

    let cpu_percent = Some(system.global_cpu_usage().round() as f64);
    let memory_total_gb = Some(((system.total_memory() as f64) / 1024.0 / 1024.0 / 1024.0 * 10.0).round() / 10.0);
    let memory_used_gb = Some(((system.used_memory() as f64) / 1024.0 / 1024.0 / 1024.0 * 10.0).round() / 10.0);

    let disks = Disks::new_with_refreshed_list();
    let system_disk = disks
        .list()
        .iter()
        .find(|disk| disk.mount_point().to_string_lossy().eq_ignore_ascii_case("C:\\"))
        .or_else(|| disks.list().first());

    let (disk_used_gb, disk_total_gb) = if let Some(disk) = system_disk {
        let total = disk.total_space() as f64;
        let available = disk.available_space() as f64;
        let used = total - available;
        (
            Some(((used / 1_073_741_824.0) * 10.0).round() / 10.0),
            Some(((total / 1_073_741_824.0) * 10.0).round() / 10.0),
        )
    } else {
        (None, None)
    };

    let mut networks = Networks::new_with_refreshed_list();
    networks.refresh(true);
    let received_bytes: u64 = networks.values().map(|data| data.total_received()).sum();
    let transmitted_bytes: u64 = networks.values().map(|data| data.total_transmitted()).sum();
    let now = Instant::now();

    let (download_kbps, upload_kbps) = if let Ok(mut snapshot) = NETWORK_SNAPSHOT.lock() {
        let current = NetworkSnapshot {
            timestamp: now,
            received_bytes,
            transmitted_bytes,
        };

        let speeds = if let Some(previous) = *snapshot {
            let elapsed = now.duration_since(previous.timestamp).as_secs_f64();
            if elapsed > 0.0 {
                let down = ((received_bytes.saturating_sub(previous.received_bytes) as f64) / 1024.0) / elapsed;
                let up = ((transmitted_bytes.saturating_sub(previous.transmitted_bytes) as f64) / 1024.0) / elapsed;
                (Some((down * 10.0).round() / 10.0), Some((up * 10.0).round() / 10.0))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        *snapshot = Some(current);
        speeds
    } else {
        (None, None)
    };

    SystemMetrics {
        cpu_percent,
        memory_used_gb,
        memory_total_gb,
        disk_used_gb,
        disk_total_gb,
        download_kbps,
        upload_kbps,
    }
}

#[tauri::command]
fn set_service_version(key: String, version: String) -> Result<String, String> {
    let available = service_versions(&key);
    if !available.iter().any(|item| item == &version) {
        return Err("Version is not installed".into());
    }
    set_selected_service_version(&key, &version)?;
    invalidate_service_snapshot();
    Ok(format!("{key} version set to {version}"))
}

fn control_service_inner(key: String, action: String, version: Option<String>) -> Result<String, String> {
    let chosen_version = version.or_else(|| get_selected_service_version(&key));

    let result = match (key.as_str(), action.as_str()) {
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
        ("postgresql", "start") => powershell("Start-Service -Name 'postgresql-x64-17'; 'PostgreSQL started'"),
        ("postgresql", "stop") => powershell("Stop-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL stopped'"),
        ("postgresql", "restart") => powershell("Restart-Service -Name 'postgresql-x64-17' -Force; 'PostgreSQL restarted'"),
        ("mailpit", "start") => {
            let exe = if Path::new(MAILPIT_EXE).exists() {
                MAILPIT_EXE.to_string()
            } else {
                command_exists_path("mailpit").ok_or_else(|| "Mailpit binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let script = format!(
                "Start-Process -FilePath '{exe}' -ArgumentList '--smtp', '127.0.0.1:1025', '--listen', '127.0.0.1:8025' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Mailpit started'"
            );
            powershell(&script)
        },
        ("mailpit", "stop") => powershell("Get-Process mailpit -ErrorAction SilentlyContinue | Stop-Process -Force; 'Mailpit stopped'"),
        ("mailpit", "restart") => {
            let exe = if Path::new(MAILPIT_EXE).exists() {
                MAILPIT_EXE.to_string()
            } else {
                command_exists_path("mailpit").ok_or_else(|| "Mailpit binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let script = format!(
                "Get-Process mailpit -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 300; Start-Process -FilePath '{exe}' -ArgumentList '--smtp', '127.0.0.1:1025', '--listen', '127.0.0.1:8025' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Mailpit restarted'"
            );
            powershell(&script)
        },
        ("pgweb", "start") => {
            let exe = if Path::new(PGWEB_EXE).exists() {
                PGWEB_EXE.to_string()
            } else {
                command_exists_path("pgweb").ok_or_else(|| "Pgweb binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let script = format!(
                "Start-Process -FilePath '{exe}' -ArgumentList '/bind:127.0.0.1', '/listen:8081', '/host:127.0.0.1', '/port:5432', '/user:postgres', '/pass:postgres', '/db:postgres', '/ssl:disable', '/skip-open' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Pgweb started'"
            );
            powershell(&script)
        },
        ("pgweb", "stop") => powershell("Get-Process pgweb -ErrorAction SilentlyContinue | Stop-Process -Force; 'Pgweb stopped'"),
        ("pgweb", "restart") => {
            let exe = if Path::new(PGWEB_EXE).exists() {
                PGWEB_EXE.to_string()
            } else {
                command_exists_path("pgweb").ok_or_else(|| "Pgweb binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let script = format!(
                "Get-Process pgweb -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 300; Start-Process -FilePath '{exe}' -ArgumentList '/bind:127.0.0.1', '/listen:8081', '/host:127.0.0.1', '/port:5432', '/user:postgres', '/pass:postgres', '/db:postgres', '/ssl:disable', '/skip-open' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Pgweb restarted'"
            );
            powershell(&script)
        },
        ("redis", "start") => {
            let exe = if Path::new(REDIS_EXE).exists() {
                REDIS_EXE.to_string()
            } else {
                command_exists_path("redis-server").ok_or_else(|| "Redis binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let conf_path = format!("{root}\\{REDIS_CONF}");
            let script = if Path::new(&conf_path).exists() {
                format!(
                    "Start-Process -FilePath '{exe}' -ArgumentList '{REDIS_CONF}' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Redis started'"
                )
            } else {
                format!(
                    "Start-Process -FilePath '{exe}' -ArgumentList '--bind', '127.0.0.1', '--port', '6379', '--protected-mode', 'yes', '--appendonly', 'no' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Redis started'"
                )
            };
            powershell(&script)
        },
        ("redis", "stop") => powershell("Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force; 'Redis stopped'"),
        ("redis", "restart") => {
            let exe = if Path::new(REDIS_EXE).exists() {
                REDIS_EXE.to_string()
            } else {
                command_exists_path("redis-server").ok_or_else(|| "Redis binary not found".to_string())?
            };
            let root = Path::new(&exe)
                .parent()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\www".into());
            let conf_path = format!("{root}\\{REDIS_CONF}");
            let script = if Path::new(&conf_path).exists() {
                format!(
                    "Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 300; Start-Process -FilePath '{exe}' -ArgumentList '{REDIS_CONF}' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Redis restarted'"
                )
            } else {
                format!(
                    "Get-Process redis-server -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Milliseconds 300; Start-Process -FilePath '{exe}' -ArgumentList '--bind', '127.0.0.1', '--port', '6379', '--protected-mode', 'yes', '--appendonly', 'no' -WorkingDirectory '{root}' -WindowStyle Hidden; 'Redis restarted'"
                )
            };
            powershell(&script)
        },
        ("memcached", "start") => start_memcached_lite(),
        ("memcached", "stop") => stop_memcached_lite(),
        ("memcached", "restart") => {
            stop_memcached_lite()?;
            start_memcached_lite()
        },
        _ => Err("Unsupported service action".into()),
    };

    if result.is_ok() {
        invalidate_service_snapshot();
    }

    result
}

#[tauri::command]
async fn get_services() -> Result<Vec<ManagedService>, String> {
    tauri::async_runtime::spawn_blocking(get_services_inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn control_service(
    key: String,
    action: String,
    version: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || control_service_inner(key, action, version))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_external(url: String) -> Result<String, String> {
    Command::new("explorer.exe")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok("Opened external link".into())
}

#[tauri::command]
fn terminate_app(app: tauri::AppHandle) {
    app.state::<AppLifecycleState>()
        .allow_exit
        .store(true, Ordering::SeqCst);
    app.exit(0);
}

#[tauri::command]
fn open_in_terminal(path: String) -> Result<String, String> {
    let target = {
        let candidate = Path::new(&path);
        if candidate.is_dir() {
            path.clone()
        } else {
            candidate
                .parent()
                .map(|parent| parent.to_string_lossy().to_string())
                .unwrap_or(path.clone())
        }
    };

    let wt_available = command_output("where", &["wt"]).is_ok();

    if wt_available {
        Command::new("cmd")
            .args(["/C", "start", "", "wt", "-d", &target])
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        let safe_target = target.replace("'", "''");
        Command::new("powershell")
            .args([
                "-NoExit",
                "-Command",
                &format!("Set-Location -LiteralPath '{}'", safe_target),
            ])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok("Opened terminal".into())
}

#[tauri::command]
fn open_git_bash(path: String) -> Result<String, String> {
    let target = {
        let candidate = Path::new(&path);
        if candidate.is_dir() {
            path.clone()
        } else {
            candidate
                .parent()
                .map(|parent| parent.to_string_lossy().to_string())
                .unwrap_or(path.clone())
        }
    };

    let git_bash = [
        "C:\\Program Files\\Git\\git-bash.exe",
        "C:\\Program Files\\Git\\bin\\bash.exe",
    ]
    .into_iter()
    .find(|candidate| Path::new(candidate).exists())
    .ok_or_else(|| "Git Bash not found".to_string())?;

    if git_bash.ends_with("git-bash.exe") {
        Command::new(git_bash)
            .current_dir(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        Command::new(git_bash)
            .args(["--login", "-i"])
            .current_dir(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok("Opened Git Bash".into())
}

fn kill_process_inner(pid: u32) -> Result<String, String> {
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

#[tauri::command]
async fn get_process_metrics(detailed: Option<bool>) -> Result<Vec<ProcessMetric>, String> {
    let detailed = detailed.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || get_process_metrics_inner(detailed))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_process(pid: u32) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || kill_process_inner(pid))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn list_virtual_hosts() -> Result<Vec<VirtualHostSummary>, String> {
    tauri::async_runtime::spawn_blocking(list_virtual_hosts_inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_virtual_host(name: String, tld: String, root: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || create_virtual_host_inner(name, tld, root))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn remove_virtual_host(domain: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || remove_virtual_host_inner(domain))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppLifecycleState::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .setup(|app| {
            let icon = Image::from_bytes(include_bytes!("../icons/icon.ico"))?;

            let open_item = MenuItemBuilder::with_id("tray_open", "Open RhinoBOX").build(app)?;
            let close_item = MenuItemBuilder::with_id("tray_close", "Close RhinoBOX").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&open_item)
                .separator()
                .item(&close_item)
                .build()?;

            TrayIconBuilder::with_id("main-tray")
                .icon(icon.clone())
                .tooltip("RhinoBOX")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "tray_open" => show_main_window(app),
                    "tray_close" => {
                        app.state::<AppLifecycleState>()
                            .allow_exit
                            .store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                if !window
                    .state::<AppLifecycleState>()
                    .allow_exit
                    .load(Ordering::SeqCst)
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_services,
            get_discovery,
            get_config_files,
            get_config_file,
            save_config_file,
            get_logs,
            get_process_metrics,
            get_system_metrics,
            set_service_version,
            control_service,
            terminate_app,
            open_external,
            open_in_terminal,
            open_git_bash,
            kill_process,
            list_virtual_hosts,
            create_virtual_host,
            remove_virtual_host
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
