use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../ui/types/generated/")]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub privacy_tier: String,
    pub decay_rate: String,
    pub summary_node_id: Option<String>,
    #[ts(type = "number")]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub meta: String,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../ui/types/generated/")]
pub struct VaultCreateInput {
    pub name: String,
    #[ts(optional)]
    pub icon: Option<String>,
    #[ts(optional)]
    pub description: Option<String>,
    #[ts(optional)]
    pub privacy_tier: Option<String>,
    #[ts(optional)]
    pub decay_rate: Option<String>,
    #[ts(optional)]
    #[ts(type = "number")]
    pub sort_order: Option<i64>,
    #[ts(optional)]
    pub meta: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../ui/types/generated/")]
pub struct Node {
    pub id: String,
    pub vault_id: String,
    pub sub_vault_id: Option<String>,
    pub node_type: String,
    pub title: String,
    pub summary: String,
    pub detail: Option<String>,
    pub source: Option<String>,
    pub source_type: Option<String>,
    pub privacy_tier: Option<String>,
    pub decay: String,
    #[ts(type = "number")]
    pub version: i64,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub deleted_at: Option<String>,
    pub meta: String,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../ui/types/generated/")]
pub struct NodeCreateInput {
    pub vault_id: String,
    #[ts(optional)]
    pub sub_vault_id: Option<String>,
    #[ts(optional)]
    pub node_type: Option<String>,
    pub title: String,
    pub summary: String,
    #[ts(optional)]
    pub detail: Option<String>,
    #[ts(optional)]
    pub source: Option<String>,
    #[ts(optional)]
    pub source_type: Option<String>,
    #[ts(optional)]
    pub privacy_tier: Option<String>,
    #[ts(optional)]
    pub decay: Option<String>,
    #[ts(optional)]
    pub meta: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../ui/types/generated/")]
pub struct NodeUpdateInput {
    pub id: String,
    #[ts(optional)]
    pub vault_id: Option<String>,
    #[ts(optional)]
    pub sub_vault_id: Option<String>,
    #[ts(optional)]
    pub node_type: Option<String>,
    #[ts(optional)]
    pub title: Option<String>,
    #[ts(optional)]
    pub summary: Option<String>,
    #[ts(optional)]
    pub detail: Option<String>,
    #[ts(optional)]
    pub source: Option<String>,
    #[ts(optional)]
    pub source_type: Option<String>,
    #[ts(optional)]
    pub privacy_tier: Option<String>,
    #[ts(optional)]
    pub decay: Option<String>,
    #[ts(optional)]
    pub is_archived: Option<bool>,
    #[ts(optional)]
    pub meta: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_typescript_bindings() {
        Vault::export().expect("failed to export Vault");
        VaultCreateInput::export().expect("failed to export VaultCreateInput");
        Node::export().expect("failed to export Node");
        NodeCreateInput::export().expect("failed to export NodeCreateInput");
        NodeUpdateInput::export().expect("failed to export NodeUpdateInput");
    }
}
