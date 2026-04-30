use std::fs;
use std::path::PathBuf;

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use tauri::Manager;

struct DbState {
    pool: SqlitePool,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from MindVault!", name)
}

fn init_sqlite(app: &tauri::App) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("mindvault.db");
    let database_url = format!("sqlite:{}", db_path.to_string_lossy());

    let pool = tauri::async_runtime::block_on(async {
        SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
    })?;

    tauri::async_runtime::block_on(async {
        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await
    })?;

    Ok(pool)
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

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .execute(pool)
    .await
    .map_err(|err| format!("Failed creating schema_migrations table: {err}"))?;

    for (version, name, path) in load_migration_files()? {
        let already_applied: i64 =
            sqlx::query_scalar("SELECT COUNT(1) FROM schema_migrations WHERE version = ?1;")
                .bind(version)
                .fetch_one(pool)
                .await
                .map_err(|err| format!("Failed checking migration {version}: {err}"))?;

        if already_applied > 0 {
            continue;
        }

        let sql = fs::read_to_string(&path)
            .map_err(|err| format!("Failed reading {}: {err}", path.display()))?;

        let mut tx = pool
            .begin()
            .await
            .map_err(|err| format!("Failed starting migration transaction: {err}"))?;

        sqlx::raw_sql(&sql)
            .execute(&mut *tx)
            .await
            .map_err(|err| format!("Migration {} failed: {err}", path.display()))?;

        sqlx::query("INSERT INTO schema_migrations (version, name) VALUES (?1, ?2);")
            .bind(version)
            .bind(&name)
            .execute(&mut *tx)
            .await
            .map_err(|err| format!("Failed recording migration {}: {err}", path.display()))?;

        tx.commit()
            .await
            .map_err(|err| format!("Failed committing migration transaction: {err}"))?;
    }

    Ok(())
}

async fn run_seed_data(pool: &SqlitePool) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|err| format!("Failed starting seed transaction: {err}"))?;

    sqlx::query(
        "INSERT OR IGNORE INTO settings (key, value, scope) VALUES
            ('default_model', '\"local\"', 'global'),
            ('local_model_endpoint', '\"http://localhost:11434\"', 'global'),
            ('decay_check_interval_h', '24', 'global'),
            ('auto_trim_threshold', '0.25', 'global'),
            ('snapshot_on_session_end', 'true', 'global'),
            ('onboarding_complete', 'false', 'global');",
    )
    .execute(&mut *tx)
    .await
    .map_err(|err| format!("Failed inserting default settings: {err}"))?;

    sqlx::query(
        "INSERT OR IGNORE INTO vaults (id, name, icon, description, privacy_tier, decay_rate, sort_order, meta)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
    )
    .bind("vault_root_graph")
    .bind("Root Graph")
    .bind("🌐")
    .bind("Always-loaded cross-vault context graph.")
    .bind("open")
    .bind("standard")
    .bind(0_i64)
    .bind("{}")
    .execute(&mut *tx)
    .await
    .map_err(|err| format!("Failed inserting Root Graph vault: {err}"))?;

    tx.commit()
        .await
        .map_err(|err| format!("Failed committing seed transaction: {err}"))?;

    Ok(())
}

#[tauri::command]
async fn db_ping(state: tauri::State<'_, DbState>) -> Result<String, String> {
    sqlx::query_scalar::<_, String>("SELECT sqlite_version();")
        .fetch_one(&state.pool)
        .await
        .map(|version| format!("SQLite connected (version {version})"))
        .map_err(|err| format!("SQLite ping failed: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let sqlite_pool = init_sqlite(app)?;
            tauri::async_runtime::block_on(run_migrations(&sqlite_pool))
                .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;
            tauri::async_runtime::block_on(run_seed_data(&sqlite_pool))
                .map_err(|err| -> Box<dyn std::error::Error> { err.into() })?;
            app.manage(DbState { pool: sqlite_pool });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, db_ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
