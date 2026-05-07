type DecayBarProps = {
  score: number | null;
};

function DecayBar({ score }: DecayBarProps) {
  const value = score !== null && Number.isFinite(score) ? score : 1.0;
  const pct = Math.round(value * 100);

  let colorClass = "decay-bar-high";
  if (value <= 0.4) {
    colorClass = "decay-bar-low";
  } else if (value <= 0.8) {
    colorClass = "decay-bar-mid";
  }

  return (
    <div className="decay-bar" title={`Decay: ${value.toFixed(2)}`}>
      <div className={`decay-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
      <span className="decay-bar-label">{value.toFixed(2)}</span>
    </div>
  );
}

export default DecayBar;
