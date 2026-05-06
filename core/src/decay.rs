use chrono::NaiveDateTime;

fn half_life(rate: &str) -> f64 {
    match rate {
        "fast" => 3.0,
        "slow" => 30.0,
        // "standard" and any unrecognized rate
        _ => 14.0,
    }
}

/// Exponential decay score based on time since last access.
/// Returns a value clamped to [0.0, 1.0].
/// Pinned nodes always return 1.0.
pub fn calculate_score(last_accessed: NaiveDateTime, rate: &str) -> f64 {
    if rate == "pinned" {
        return 1.0;
    }

    let now = chrono::Utc::now().naive_utc();
    let elapsed_days = (now - last_accessed).num_seconds() as f64 / 86_400.0;

    if elapsed_days < 0.0 {
        return 1.0;
    }

    let hl = half_life(rate);
    let lambda = f64::ln(2.0) / hl;
    let score = f64::exp(-lambda * elapsed_days);

    score.clamp(0.0, 1.0)
}

const MAX_HISTORY_LEN: usize = 90;

/// Roll over daily access counters.
/// Pushes `today_touches` onto the front of `access_history`,
/// caps the history at 90 entries, resets `today_touches` to 0,
/// and recomputes `access_count_30d` / `access_count_90d`.
pub fn calculate_rollover(mut decay_json: serde_json::Value) -> serde_json::Value {
    let today = decay_json
        .get("today_touches")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let mut history: Vec<u64> = decay_json
        .get("access_history")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|item| item.as_u64()).collect())
        .unwrap_or_default();

    history.insert(0, today);
    history.truncate(MAX_HISTORY_LEN);

    let access_30d: u64 = history.iter().take(30).sum();
    let access_90d: u64 = history.iter().sum();

    decay_json["today_touches"] = serde_json::json!(0);
    decay_json["access_history"] = serde_json::json!(history);
    decay_json["access_count_30d"] = serde_json::json!(access_30d);
    decay_json["access_count_90d"] = serde_json::json!(access_90d);

    decay_json
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinned_always_returns_one() {
        let ts = chrono::Utc::now().naive_utc() - chrono::Duration::days(365);
        assert!((calculate_score(ts, "pinned") - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn standard_half_life_at_14_days() {
        let ts = chrono::Utc::now().naive_utc() - chrono::Duration::days(14);
        let score = calculate_score(ts, "standard");
        assert!((score - 0.5).abs() < 0.02, "expected ~0.5, got {score}");
    }

    #[test]
    fn future_timestamp_returns_one() {
        let ts = chrono::Utc::now().naive_utc() + chrono::Duration::hours(2);
        assert!((calculate_score(ts, "standard") - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn fast_decays_quicker_than_slow() {
        let ts = chrono::Utc::now().naive_utc() - chrono::Duration::days(7);
        let fast = calculate_score(ts, "fast");
        let slow = calculate_score(ts, "slow");
        assert!(
            fast < slow,
            "fast ({fast}) should be less than slow ({slow})"
        );
    }

    #[test]
    fn rollover_pushes_today_to_history() {
        let input = serde_json::json!({
            "today_touches": 5,
            "access_history": [3, 2, 1]
        });
        let result = calculate_rollover(input);
        assert_eq!(result["today_touches"], 0);
        let history = result["access_history"].as_array().unwrap_or_else(|| {
            panic!("access_history missing");
        });
        assert_eq!(history[0], 5);
        assert_eq!(history[1], 3);
        assert_eq!(history.len(), 4);
    }

    #[test]
    fn rollover_computes_30d_and_90d_sums() {
        let mut history = vec![1u64; 40];
        history.truncate(40);
        let input = serde_json::json!({
            "today_touches": 2,
            "access_history": history
        });
        let result = calculate_rollover(input);
        // history is now [2, 1*40] = 41 items
        // 30d sum = 2 + 29*1 = 31
        assert_eq!(result["access_count_30d"], 31);
        // 90d sum = 2 + 40*1 = 42
        assert_eq!(result["access_count_90d"], 42);
    }

    #[test]
    fn rollover_caps_history_at_90() {
        let history = vec![1u64; 95];
        let input = serde_json::json!({
            "today_touches": 1,
            "access_history": history
        });
        let result = calculate_rollover(input);
        let arr = result["access_history"].as_array().unwrap_or_else(|| {
            panic!("access_history missing");
        });
        assert_eq!(arr.len(), 90);
    }

    #[test]
    fn rollover_handles_empty_defaults() {
        let input = serde_json::json!({});
        let result = calculate_rollover(input);
        assert_eq!(result["today_touches"], 0);
        assert_eq!(result["access_count_30d"], 0);
        assert_eq!(result["access_count_90d"], 0);
        let arr = result["access_history"].as_array().unwrap_or_else(|| {
            panic!("access_history missing");
        });
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0], 0);
    }
}
