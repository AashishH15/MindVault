use std::fs;

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
            app.manage(DbState { pool: sqlite_pool });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, db_ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
