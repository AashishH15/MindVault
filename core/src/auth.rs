use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::OsRng;
use rusqlite::params;

use crate::{into_ipc, open_connection, DbState, IpcResponse};

const MASTER_PASSWORD_KEY: &str = "master_password_hash";

fn fetch_master_hash(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1;",
        [MASTER_PASSWORD_KEY],
        |row| row.get::<_, String>(0),
    )
    .map(Some)
    .or_else(|err| {
        if matches!(err, rusqlite::Error::QueryReturnedNoRows) {
            Ok(None)
        } else {
            Err(format!("Failed reading master password hash: {err}"))
        }
    })
}

#[tauri::command]
pub fn auth_is_setup(state: tauri::State<'_, DbState>) -> IpcResponse<bool> {
    into_ipc((|| {
        let conn = open_connection(&state.db_path)?;
        Ok(fetch_master_hash(&conn)?.is_some())
    })())
}

#[tauri::command]
pub fn auth_set_password(password: String, state: tauri::State<'_, DbState>) -> IpcResponse<bool> {
    into_ipc((|| {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let phc_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|err| format!("Failed hashing password: {err}"))?
            .to_string();

        let stored_value = serde_json::to_string(&phc_hash)
            .map_err(|err| format!("Failed serializing master password hash: {err}"))?;

        let conn = open_connection(&state.db_path)?;
        conn.execute(
            "INSERT INTO settings (key, value, scope, updated_at)
             VALUES (?1, ?2, 'global', datetime('now'))
             ON CONFLICT(key) DO UPDATE
             SET value = excluded.value,
                 updated_at = datetime('now');",
            params![MASTER_PASSWORD_KEY, stored_value],
        )
        .map_err(|err| format!("Failed storing master password hash: {err}"))?;

        Ok(true)
    })())
}

#[tauri::command]
pub fn auth_verify_password(
    password: String,
    state: tauri::State<'_, DbState>,
) -> IpcResponse<bool> {
    into_ipc((|| {
        let conn = open_connection(&state.db_path)?;
        let stored_value = match fetch_master_hash(&conn)? {
            Some(value) => value,
            None => return Ok(false),
        };

        let phc_hash: String = serde_json::from_str(&stored_value)
            .map_err(|err| format!("Failed parsing stored master password hash: {err}"))?;

        let parsed_hash = PasswordHash::new(&phc_hash)
            .map_err(|err| format!("Failed parsing argon2 PHC hash: {err}"))?;

        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok())
    })())
}
