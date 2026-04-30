use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use tauri::Manager;

struct DbState {
    db_path: PathBuf,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from MindVault!", name)
}

fn sqlite_db_path(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join("mindvault.db"))
}

fn open_connection(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path)
        .map_err(|err| format!("Failed opening database {}: {err}", db_path.display()))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|err| format!("Failed enabling foreign keys: {err}"))?;
    Ok(conn)
}

fn migrations_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("db")
        .join("migrations")
}

fn load_migration_files() -> Result<Vec<(i64, String, PathBuf)>, String> {
    let dir = migrations_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir).map_err(|err| {
        format!(
            "Failed to read migrations directory {}: {err}",
            dir.display()
        )
    })?;

    let mut migrations = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|err| format!("Failed to read migration entry: {err}"))?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };

        if !file_name.ends_with(".sql") {
            continue;
        }

        let Some((version_text, rest)) = file_name.split_once('_') else {
            return Err(format!(
                "Migration file must follow '<version>_<name>.sql': {file_name}"
            ));
        };

        let version = version_text
            .parse::<i64>()
            .map_err(|_| format!("Migration version must be numeric: {file_name}"))?;

        let name = rest.trim_end_matches(".sql").to_string();
        if name.is_empty() {
            return Err(format!("Migration name is missing in file: {file_name}"));
        }

        migrations.push((version, name, path));
    }

    migrations.sort_by_key(|migration| migration.0);

    for i in 1..migrations.len() {
        if migrations[i - 1].0 == migrations[i].0 {
            return Err(format!(
                "Duplicate migration version detected: {}",
                migrations[i].0
            ));
        }
    }

    Ok(migrations)
}

fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .map_err(|err| format!("Failed creating schema_migrations table: {err}"))?;

    for (version, name, path) in load_migration_files()? {
        let already_applied: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM schema_migrations WHERE version = ?1;",
                [version],
                |row| row.get(0),
            )
            .map_err(|err| format!("Failed checking migration {version}: {err}"))?;

        if already_applied > 0 {
            continue;
        }

        let sql = fs::read_to_string(&path)
            .map_err(|err| format!("Failed reading {}: {err}", path.display()))?;

        let tx = conn
            .transaction()
            .map_err(|err| format!("Failed starting migration transaction: {err}"))?;

        tx.execute_batch(&sql)
            .map_err(|err| format!("Migration {} failed: {err}", path.display()))?;

        tx.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2);",
            params![version, name],
        )
        .map_err(|err| format!("Failed recording migration {}: {err}", path.display()))?;

        tx.commit()
            .map_err(|err| format!("Failed committing migration transaction: {err}"))?;
    }

    Ok(())
}

fn run_seed_data(conn: &mut Connection) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|err| format!("Failed starting seed transaction: {err}"))?;

    tx.execute_batch(
        "INSERT OR IGNORE INTO settings (key, value, scope) VALUES
            ('default_model', '\"local\"', 'global'),
            ('local_model_endpoint', '\"http://localhost:11434\"', 'global'),
            ('decay_check_interval_h', '24', 'global'),
            ('auto_trim_threshold', '0.25', 'global'),
            ('snapshot_on_session_end', 'true', 'global'),
            ('onboarding_complete', 'false', 'global');",
    )
    .map_err(|err| format!("Failed inserting default settings: {err}"))?;

    tx.execute(
        "INSERT OR IGNORE INTO vaults (id, name, icon, description, privacy_tier, decay_rate, sort_order, meta)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
        params![
            "vault_root_graph",
            "Root Graph",
            "root",
            "Always-loaded cross-vault context graph.",
            "open",
            "standard",
            0_i64,
            "{}"
        ],
    )
    .map_err(|err| format!("Failed inserting Root Graph vault: {err}"))?;

    tx.commit()
        .map_err(|err| format!("Failed committing seed transaction: {err}"))?;

    Ok(())
}

#[tauri::command]
fn db_ping(state: tauri::State<'_, DbState>) -> Result<String, String> {
    let conn = open_connection(&state.db_path)?;
    let version: String = conn
        .query_row("SELECT sqlite_version();", [], |row| row.get(0))
        .map_err(|err| format!("SQLite ping failed: {err}"))?;
    Ok(format!("SQLite connected (version {version})"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = sqlite_db_path(app)?;
            let mut conn = open_connection(&db_path)
                .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;
            run_migrations(&mut conn)
                .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;
            run_seed_data(&mut conn).map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;
            app.manage(DbState { db_path });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, db_ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
