interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
}

const scoreColor = (s: number) => {
  if (s >= 80) return '#00C896'   // teal
  if (s >= 60) return '#3D6BFF'   // blue
  if (s >= 40) return '#F59E0B'   // amber
  return '#EF4444'                 // red
}

export default function ScoreRing({
  score,
  size = 64,
  strokeWidth = 5,
  label,
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1E2D45"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
            fill: color,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 500,
            fontSize: size * 0.26,
          }}
        >
          {score}
        </text>
      </svg>
      {label && <span className="text-fog text-xs">{label}</span>}
    </div>
  )
}
