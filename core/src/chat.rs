use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// Default session id used to anchor the always-on chat thread until
/// multi-session UI lands. The schema requires `session_id NOT NULL`
/// (see db/migrations/0001_schema_v1.sql), so we keep one canonical row.
const DEFAULT_SESSION_ID: &str = "default-session";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

fn ensure_default_session(db: &Connection) -> Result<(), crate::AppError> {
    db.execute(
        "INSERT OR IGNORE INTO sessions (id, scope_json) VALUES (?1, '[]');",
        params![DEFAULT_SESSION_ID],
    )
    .map_err(|err| format!("Failed ensuring default chat session: {err}"))?;
    Ok(())
}

pub fn get_chat_history(db: &Connection) -> Result<Vec<ChatMessage>, crate::AppError> {
    ensure_default_session(db)?;

    let mut statement = db
        .prepare(
            "SELECT id, role, content, created_at
             FROM session_messages
             WHERE session_id = ?1
             ORDER BY created_at ASC, id ASC;",
        )
        .map_err(|err| format!("Failed preparing chat history query: {err}"))?;

    let rows = statement
        .query_map(params![DEFAULT_SESSION_ID], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|err| format!("Failed querying chat history: {err}"))?;

    let mut messages = Vec::new();
    for row in rows {
        messages.push(row.map_err(|err| format!("Failed decoding chat history row: {err}"))?);
    }
    Ok(messages)
}

pub fn append_message(
    db: &Connection,
    id: String,
    role: String,
    content: String,
) -> Result<(), crate::AppError> {
    ensure_default_session(db)?;

    db.execute(
        "INSERT INTO session_messages (id, session_id, role, content)
         VALUES (?1, ?2, ?3, ?4);",
        params![id, DEFAULT_SESSION_ID, role, content],
    )
    .map_err(|err| format!("Failed appending chat message: {err}"))?;

    Ok(())
}

pub fn clear_chat_history(db: &Connection) -> Result<(), crate::AppError> {
    ensure_default_session(db)?;

    db.execute(
        "DELETE FROM session_messages WHERE session_id = ?1;",
        params![DEFAULT_SESSION_ID],
    )
    .map_err(|err| format!("Failed clearing chat history: {err}"))?;

    Ok(())
}
