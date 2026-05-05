const PRIVACY_RANKS: Record<string, number> = {
  open: 0,
  local_only: 1,
  locked: 2,
  redacted: 3,
};

function normalizeTier(tier?: string | null): string {
  if (!tier) {
    return "open";
  }
  return tier in PRIVACY_RANKS ? tier : "open";
}

export function getEffectivePrivacy(
  nodeTier?: string | null,
  subVaultTier?: string | null,
  vaultTier?: string | null
): string {
  const tiers = [normalizeTier(nodeTier), normalizeTier(subVaultTier), normalizeTier(vaultTier)];

  return tiers.reduce((strictest, current) =>
    PRIVACY_RANKS[current] > PRIVACY_RANKS[strictest] ? current : strictest
  );
}
