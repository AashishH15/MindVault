use crate::memory_agent::changeset::{ChangesetItemType, PendingChangeset};
use rusqlite::{params, Connection};

/// Persists a built changeset and its pending items into SQLite.
/// Returns the generated changeset ID.
pub fn persist_changeset(
    conn: &Connection,
    changeset: &PendingChangeset,
    model_used: Option<&str>,
) -> Result<String, String> {
    // 1. Generate unique changeset ID
    let changeset_id = crate::generate_id(conn, "cs")?;

    // 2. Insert Changeset
    conn.execute(
        "INSERT INTO changesets (id, session_id, status, item_count, accepted_count, dismissed_count, model_used, created_at)
         VALUES (?1, ?2, 'pending', ?3, 0, 0, ?4, datetime('now'));",
        params![
            changeset_id,
            changeset.session_id,
            changeset.items.len() as i64,
            model_used,
        ],
    )
    .map_err(|err| format!("Failed to insert changeset: {err}"))?;

    // 3. Insert Changeset Items
    for (i, item) in changeset.items.iter().enumerate() {
        let item_id = crate::generate_id(conn, "csi")?;
        let item_type_str = match item.item_type {
            ChangesetItemType::Add => "add",
            ChangesetItemType::Update => "update",
            ChangesetItemType::Merge => "merge",
            ChangesetItemType::Delete => "delete",
        };

        conn.execute(
            "INSERT INTO changeset_items (id, changeset_id, item_type, target_node_id, proposed_data, existing_data, similarity, merge_with_id, status, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9);",
            params![
                item_id,
                changeset_id,
                item_type_str,
                item.target_node_id,
                item.proposed_data,
                item.existing_data,
                item.similarity,
                item.merge_with_id,
                i as i64, // sort_order
            ],
        )
        .map_err(|err| format!("Failed to insert changeset item: {err}"))?;
    }

    Ok(changeset_id)
}

/// Counts total pending changeset items.
pub fn count_pending_items(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM changeset_items WHERE status = 'pending';",
        [],
        |row| row.get(0),
    )
    .map_err(|err| format!("Failed counting pending changeset items: {err}"))
}

/// Lists all pending changesets ordered by creation time descending.
pub fn list_pending_changesets(
    conn: &Connection,
) -> Result<Vec<crate::ipc_types::Changeset>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, status, item_count, accepted_count, dismissed_count, model_used, created_at, reviewed_at
             FROM changesets
             WHERE status = 'pending'
             ORDER BY created_at DESC;",
        )
        .map_err(|err| format!("Failed to prepare list pending changesets query: {err}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(crate::ipc_types::Changeset {
                id: row.get(0)?,
                session_id: row.get(1)?,
                status: row.get(2)?,
                item_count: row.get(3)?,
                accepted_count: row.get(4)?,
                dismissed_count: row.get(5)?,
                model_used: row.get(6)?,
                created_at: row.get(7)?,
                reviewed_at: row.get(8)?,
            })
        })
        .map_err(|err| format!("Failed to execute list pending changesets query: {err}"))?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| format!("Failed decoding changeset row: {e}"))?);
    }
    Ok(list)
}

/// Lists all items in a changeset ordered by sort order.
pub fn list_changeset_items(
    conn: &Connection,
    changeset_id: &str,
) -> Result<Vec<crate::ipc_types::ChangesetItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, changeset_id, item_type, target_node_id, proposed_data, existing_data, similarity, merge_with_id, door_id, status, reviewed_at, sort_order
             FROM changeset_items
             WHERE changeset_id = ?1
             ORDER BY sort_order ASC, id ASC;",
        )
        .map_err(|err| format!("Failed to prepare list changeset items query: {err}"))?;

    let rows = stmt
        .query_map([changeset_id], |row| {
            Ok(crate::ipc_types::ChangesetItem {
                id: row.get(0)?,
                changeset_id: row.get(1)?,
                item_type: row.get(2)?,
                target_node_id: row.get(3)?,
                proposed_data: row.get(4)?,
                existing_data: row.get(5)?,
                similarity: row.get(6)?,
                merge_with_id: row.get(7)?,
                door_id: row.get(8)?,
                status: row.get(9)?,
                reviewed_at: row.get(10)?,
                sort_order: row.get(11)?,
            })
        })
        .map_err(|err| format!("Failed to execute list changeset items query: {err}"))?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| format!("Failed decoding changeset item row: {e}"))?);
    }
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory_agent::changeset::PendingChangesetItem;

    fn setup_test_db() -> Connection {
        let conn = match Connection::open_in_memory() {
            Ok(c) => c,
            Err(e) => panic!("Failed to open in-memory DB: {e}"),
        };
        let ddl = "
            CREATE TABLE changesets (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'partial')),
                item_count INTEGER NOT NULL DEFAULT 0,
                accepted_count INTEGER NOT NULL DEFAULT 0,
                dismissed_count INTEGER NOT NULL DEFAULT 0,
                model_used TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                reviewed_at TEXT
            );
            CREATE TABLE changeset_items (
                id TEXT PRIMARY KEY,
                changeset_id TEXT NOT NULL REFERENCES changesets(id) ON DELETE CASCADE,
                item_type TEXT NOT NULL CHECK (item_type IN ('add', 'update', 'merge', 'delete', 'repoint_door', 'orphan_alert')),
                target_node_id TEXT,
                proposed_data TEXT NOT NULL DEFAULT '{}',
                existing_data TEXT DEFAULT '{}',
                similarity REAL,
                merge_with_id TEXT,
                door_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'edited')),
                reviewed_at TEXT,
                sort_order INTEGER DEFAULT 0
            );
        ";
        if let Err(e) = conn.execute_batch(ddl) {
            panic!("Failed to create DDL: {e}");
        }
        conn
    }

    #[test]
    fn test_persist_and_retrieve_changesets() -> Result<(), Box<dyn std::error::Error>> {
        let conn = setup_test_db();

        // 1. Initial counts: should be empty
        assert_eq!(count_pending_items(&conn)?, 0);
        assert!(list_pending_changesets(&conn)?.is_empty());

        // 2. Prepare a mock PendingChangeset
        let pending = PendingChangeset {
            session_id: "session-123".to_string(),
            model_used: None,
            items: vec![
                PendingChangesetItem {
                    item_type: ChangesetItemType::Add,
                    target_node_id: None,
                    proposed_data: "{\"title\":\"Rust fact\"}".to_string(),
                    existing_data: None,
                    similarity: None,
                    merge_with_id: None,
                },
                PendingChangesetItem {
                    item_type: ChangesetItemType::Update,
                    target_node_id: Some("node_abc".to_string()),
                    proposed_data: "{\"title\":\"Acme Corp update\"}".to_string(),
                    existing_data: Some("{\"title\":\"Acme Corp\"}".to_string()),
                    similarity: Some(0.92),
                    merge_with_id: None,
                },
            ],
        };

        // 3. Persist changeset
        let cs_id = persist_changeset(&conn, &pending, Some("llama3"))?;
        assert!(cs_id.starts_with("cs_"));

        // 4. Verify counts & list changesets
        assert_eq!(count_pending_items(&conn)?, 2);
        let changesets = list_pending_changesets(&conn)?;
        assert_eq!(changesets.len(), 1);
        assert_eq!(changesets[0].id, cs_id);
        assert_eq!(changesets[0].session_id, Some("session-123".to_string()));
        assert_eq!(changesets[0].status, "pending");
        assert_eq!(changesets[0].item_count, 2);
        assert_eq!(changesets[0].model_used, Some("llama3".to_string()));

        // 5. Verify list changeset items
        let items = list_changeset_items(&conn, &cs_id)?;
        assert_eq!(items.len(), 2);

        assert_eq!(items[0].changeset_id, cs_id);
        assert_eq!(items[0].item_type, "add");
        assert_eq!(items[0].target_node_id, None);
        assert_eq!(items[0].proposed_data, "{\"title\":\"Rust fact\"}");
        assert_eq!(items[0].existing_data, None);
        assert_eq!(items[0].similarity, None);
        assert_eq!(items[0].sort_order, 0);

        assert_eq!(items[1].changeset_id, cs_id);
        assert_eq!(items[1].item_type, "update");
        assert_eq!(items[1].target_node_id, Some("node_abc".to_string()));
        assert_eq!(items[1].proposed_data, "{\"title\":\"Acme Corp update\"}");
        assert_eq!(
            items[1].existing_data,
            Some("{\"title\":\"Acme Corp\"}".to_string())
        );
        assert_eq!(items[1].similarity, Some(0.92));
        assert_eq!(items[1].sort_order, 1);

        Ok(())
    }
}
