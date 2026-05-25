use std::fs;
use std::path::PathBuf;

use rusqlite::Connection;

fn migration_file_path(file_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("db")
        .join("migrations")
        .join(file_name)
}

fn apply_migration(conn: &Connection, file_name: &str) {
    let migration_sql = match fs::read_to_string(migration_file_path(file_name)) {
        Ok(value) => value,
        Err(err) => panic!("failed to read migration file {file_name}: {err}"),
    };
    if let Err(err) = conn.execute_batch(&migration_sql) {
        panic!("failed to execute migration {file_name}: {err}");
    }
}

#[test]
fn ui_metadata_backfill_repairs_existing_vault_rows() {
    let conn = Connection::open_in_memory().expect("failed to open in-memory sqlite");
    conn.pragma_update(None, "foreign_keys", "ON")
        .expect("failed to enable foreign keys");

    apply_migration(&conn, "0001_schema_v1.sql");

    conn.execute(
        "INSERT INTO vaults (id, name, icon, description, privacy_tier, priority_profile, sort_order, meta)
         VALUES ('vault_legacy', 'Legacy Vault', NULL, NULL, 'open', 'standard', 0, '{}');",
        [],
    )
    .expect("failed to insert legacy vault");
    conn.execute(
        "INSERT INTO sub_vaults (id, vault_id, name, icon, description, privacy_tier, priority_profile, sort_order, meta)
         VALUES ('sub_legacy', 'vault_legacy', 'Legacy Subvault', NULL, NULL, 'open', 'standard', 0, '{}');",
        [],
    )
    .expect("failed to insert legacy sub-vault");

    apply_migration(&conn, "0004_vault_ui_metadata.sql");

    conn.execute(
        "UPDATE vaults SET ui_metadata = NULL WHERE id = 'vault_legacy';",
        [],
    )
    .expect("failed to null out legacy vault ui_metadata");
    conn.execute(
        "UPDATE sub_vaults SET ui_metadata = NULL WHERE id = 'sub_legacy';",
        [],
    )
    .expect("failed to null out legacy sub-vault ui_metadata");

    apply_migration(&conn, "0006_vault_ui_metadata_backfill.sql");

    let vault_ui_metadata: String = conn
        .query_row(
            "SELECT ui_metadata FROM vaults WHERE id = 'vault_legacy';",
            [],
            |row| row.get(0),
        )
        .expect("failed to read vault ui_metadata");
    let sub_vault_ui_metadata: String = conn
        .query_row(
            "SELECT ui_metadata FROM sub_vaults WHERE id = 'sub_legacy';",
            [],
            |row| row.get(0),
        )
        .expect("failed to read sub-vault ui_metadata");

    assert_eq!(vault_ui_metadata, "{}");
    assert_eq!(sub_vault_ui_metadata, "{}");
}
