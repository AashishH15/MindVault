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
        // After exactly one half-life the score should be ~0.5
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
}
