<p align="center">
  <img src="assets/branding/rhinobox.png" alt="RhinoBOX" width="120">
</p>

# RhinoBOX

RhinoBOX is a desktop utility for managing a local development environment on Windows.

It is built with Tauri v2, React, TypeScript, and Mantine, and is aimed at the same practical space as tools like Laragon: quick service control, configuration access, process visibility, and multi-version runtime handling from one compact UI.

## Current Scope

RhinoBOX currently focuses on:

- `nginx` control
- `PHP-CGI` control
- `MariaDB` and `PostgreSQL` control
- `Mailpit`, `Pgweb`, `Redis`, and Memcached Lite service control
- multi-version switching for `nginx`, `PHP`, and `Node.js`
- quick launch actions for `localhost`, `phpMyAdmin`, `Mailpit`, and `Pgweb`
- project listing and quick actions from `C:\www`
- discovery of important local paths
- config editing for environment files
- tabbed log viewing
- process monitoring with kill action
- virtual domains with `.test` / `.local` style local hostnames

The app is designed first for real local Windows setups, including installs that come from mixed sources such as Winget, custom folders, and manual runtime drops.

## Stack

- Tauri v2
- React 18
- TypeScript
- Vite
- Mantine UI
- Rust backend commands for native Windows integration

## Project Structure

```text
src/                 React UI
src/components/      Reusable UI building blocks
src/pages/           App pages
src/lib/             Frontend API/runtime helpers
src/store/           Zustand UI state
src-tauri/           Native Tauri backend
api/                 Browser-mode bridge endpoints
assets/branding/     RhinoBOX logo assets
```

## Features

### Dashboard

- service cards for local runtimes
- optional compact service list view
- start / stop / restart actions
- version dropdowns for supported multi-version services
- quick actions for `Localhost`, `phpMyAdmin`, `Mailpit`, and `Pgweb`

### Projects

- scans local project folders in `C:\www`
- detects common project types such as Laravel, WordPress, PHP, Node.js, Go, and Python
- links projects to configured virtual domains when available
- quick actions for browser, VS Code, terminal, and folder

### Discovery

- shows detected paths like:
  - workspace root
  - web root
  - `nginx.conf`
  - `php.ini`
  - database config/data paths
  - helper binaries like `Mailpit`, `Pgweb`, and `Redis`
  - virtual host config directory

### Config Editor

- opens supported config files
- saves changes back to disk
- supports quick service reload flow

### Logs

- lightweight access to local service/app logs
- tabbed layout for the logs RhinoBOX actually manages

### Process Monitor

- lists Windows processes
- search/filter support
- process kill action

### Virtual Domains

- creates local `.test` or `.local` hostnames
- writes nginx vhost files
- updates Windows hosts entries when allowed

### Cache and Mail Helpers

- `Mailpit` local SMTP inbox on ports `1025` and `8025`
- `Redis` local cache on port `6379`
- embedded Memcached Lite endpoint on port `11211`
- `Pgweb` lightweight PostgreSQL web client on port `8081`

## Requirements

Recommended for local Windows development machines with:

- Node.js
- Rust / Cargo
- Visual Studio C++ build tools
- local runtimes you want RhinoBOX to manage, such as:
  - `nginx`
  - `PHP`
  - `MariaDB`
  - `PostgreSQL`
  - `Redis`

## Development

### Install frontend dependencies

```powershell
npm install
```

### Run browser dev mode

```powershell
npm run dev
```

### Run native desktop dev mode

```powershell
npm run tauri -- dev
```

### Build frontend

```powershell
npm run build
```

### Check Tauri backend

```powershell
cd src-tauri
cargo check
```

## Notes

- RhinoBOX is currently Windows-first.
- Multi-version switching is implemented first around `nginx`, `PHP`, and `Node.js`.
- Some local service detection depends on the actual install layout on the machine.

## Roadmap Direction

Planned evolution includes:

- better automatic discovery
- more runtime/service integrations
- richer config validation flows
- virtual host and project management
- a denser utility-style desktop UI

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
