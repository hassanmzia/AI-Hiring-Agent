import React from 'react';

interface ScoreBarProps {
  score: number | null;
  maxScore?: number;
  showLabel?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ score, maxScore = 1, showLabel = true }) => {
  if (score === null || score === undefined) return <span className="badge badge-gray">N/A</span>;

  const pct = Math.round((score / maxScore) * 100);
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}>
      <div className="score-bar" style={{ flex: 1 }}>
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showLabel && <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{pct}%</span>}
    </div>
  );
};

export default ScoreBar;
