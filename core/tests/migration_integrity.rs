use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use rusqlite::Connection;

fn migration_file_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("db")
        .join("migrations")
        .join("0001_schema_v1.sql")
}

fn apply_migration(conn: &Connection) {
    let migration_sql =
        fs::read_to_string(migration_file_path()).expect("failed to read schema migration file");
    conn.execute_batch(&migration_sql)
        .expect("failed to execute schema migration");
}

fn assert_tables_exist(conn: &Connection) {
    let required_tables = [
        "vaults",
        "sub_vaults",
        "nodes",
        "node_embeddings",
        "tags",
        "node_tags",
        "doors",
        "backlinks",
        "changesets",
        "changeset_items",
        "snapshots",
        "snapshot_nodes",
        "sessions",
        "session_messages",
        "routing_feedback",
        "import_jobs",
        "privacy_overrides",
        "settings",
        "schema_migrations",
    ];

    for table in required_tables {
        let exists = conn
            .query_row(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?1;",
                [table],
                |row| row.get::<_, i64>(0),
            )
            .expect("failed to query sqlite_master for table");
        assert!(exists > 0, "missing table: {table}");
    }
}

fn assert_indexes_exist(conn: &Connection) {
    let required_indexes = [
        "idx_vaults_privacy",
        "idx_vaults_deleted",
        "idx_sub_vaults_vault",
        "idx_nodes_vault",
        "idx_nodes_sub_vault",
        "idx_nodes_type",
        "idx_nodes_deleted",
        "idx_nodes_archived",
        "idx_nodes_accessed",
        "idx_node_tags_tag",
        "idx_doors_source",
        "idx_doors_target",
        "idx_doors_status",
        "idx_backlinks_target",
        "idx_backlinks_source",
        "idx_changesets_status",
        "idx_changeset_items_changeset",
        "idx_changeset_items_status",
        "idx_changeset_items_target",
        "idx_snapshots_vault",
        "idx_snapshots_version",
        "idx_sessions_vault",
        "idx_session_msgs_sess",
        "idx_routing_feedback_vault",
        "idx_routing_feedback_type",
    ];

    for index in required_indexes {
        let exists = conn
            .query_row(
                "SELECT COUNT(1) FROM sqlite_master WHERE type = 'index' AND name = ?1;",
                [index],
                |row| row.get::<_, i64>(0),
            )
            .expect("failed to query sqlite_master for index");
        assert!(exists > 0, "missing index: {index}");
    }
}

fn assert_foreign_keys_exist(conn: &Connection) {
    let fk_expectations: [(&str, &[&str]); 13] = [
        ("sub_vaults", &["vaults"]),
        ("nodes", &["vaults", "sub_vaults"]),
        ("node_embeddings", &["nodes"]),
        ("node_tags", &["nodes", "tags"]),
        ("doors", &["nodes", "vaults"]),
        ("backlinks", &["nodes", "doors"]),
        ("changeset_items", &["changesets", "nodes", "doors"]),
        ("snapshots", &["vaults", "changesets"]),
        ("sessions", &["vaults"]),
        ("session_messages", &["sessions"]),
        ("routing_feedback", &["sessions", "vaults"]),
        ("import_jobs", &["vaults", "changesets"]),
        ("privacy_overrides", &["nodes"]),
    ];

    for (table, expected_targets) in fk_expectations {
        let pragma_sql = format!("PRAGMA foreign_key_list({table});");
        let mut statement = conn
            .prepare(&pragma_sql)
            .expect("failed to prepare pragma query");
        let fk_rows = statement
            .query_map([], |row| row.get::<_, String>(2))
            .expect("failed to query foreign keys");

        let mut target_counts: HashMap<String, usize> = HashMap::new();
        for target_table in fk_rows {
            let target_table = target_table.expect("failed to decode foreign key row");
            *target_counts.entry(target_table).or_insert(0) += 1;
        }

        for expected_target in expected_targets {
            let exists = target_counts.get(*expected_target).copied().unwrap_or(0) > 0;
            assert!(
                exists,
                "missing foreign key on {table} referencing {expected_target}"
            );
        }
    }
}

#[test]
fn schema_integrity_migration_has_tables_indexes_and_foreign_keys() {
    let conn = Connection::open_in_memory().expect("failed to connect in-memory sqlite");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("failed to enable foreign keys");

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )
    .expect("failed to create schema_migrations table");

    apply_migration(&conn);
    assert_tables_exist(&conn);
    assert_indexes_exist(&conn);
    assert_foreign_keys_exist(&conn);
}
