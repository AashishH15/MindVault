const TIER_ICONS: Record<string, string> = {
  open: "🌐",
  local_only: "🏠",
  locked: "🔒",
  redacted: "⬛",
};

export function PrivacyBadge({ tier, className }: { tier: string; className?: string }) {
  const normalizedTier = tier in TIER_ICONS ? tier : "open";
  const icon = TIER_ICONS[normalizedTier];

  return <span className={`privacy-badge ${normalizedTier} ${className || ""}`}>{icon}</span>;
}
