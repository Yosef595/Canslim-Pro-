import { useRef, useState, useEffect } from 'react'

export default function CandleChart({ candles, height = 240 }) {
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims] = useState({ w: 600 })
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(e => setDims({ w: e[0].contentRect.width }))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  if (!candles || candles.length === 0) return null

  const data = candles.slice(-60)
  const N = data.length
  const W = dims.w, H = height
  const PL = 52, PR = 8, PT = 10, PB = 34
  const CW = W - PL - PR, CH = H - PT - PB

  const highs = data.map(c => c.high), lows = data.map(c => c.low)
  const minP = Math.min(...lows) * 0.997
  const maxP = Math.max(...highs) * 1.003
  const pRange = maxP - minP || 1

  const vols = data.map(c => c.volume || 0)
  const maxVol = Math.max(...vols) || 1
  const gap = CW / N
  const cw = Math.max(2, gap * 0.72)

  const yP = p => PT + ((maxP - p) / pRange) * CH
  const xC = i => PL + i * gap + gap / 2

  // MA lines from full candle history
  const allCloses = candles.map(c => c.adjclose || c.close)
  const getMA = days => data.map((_, i) => {
    const idx = candles.length - N + i
    if (idx < days - 1) return null
    const sl = allCloses.slice(idx - days + 1, idx + 1)
    return sl.reduce((a, b) => a + b, 0) / days
  })
  const ma20 = getMA(20)
  const ma50 = getMA(50)

  const maPath = (arr, color) => {
    let d = ''
    arr.forEach((v, i) => {
      if (v != null) {
        const prev = arr[i - 1]
        d += `${d && prev != null ? 'L' : 'M'}${xC(i).toFixed(1)},${yP(v).toFixed(1)}`
      }
    })
    return d ? <path d={d} fill="none" stroke={color} strokeWidth="1.3" opacity="0.9" /> : null
  }

  const priceLabels = Array.from({ length: 5 }, (_, i) => minP + pRange * i / 4)

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height, display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid */}
        {priceLabels.map((p, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={yP(p)} y2={yP(p)} stroke="var(--border)" strokeWidth="0.8" />
            <text x={PL - 4} y={yP(p)} textAnchor="end" dominantBaseline="middle"
              fill="var(--muted)" fontSize="9" fontFamily="'DM Mono', monospace">
              ${p >= 1000 ? p.toFixed(0) : p.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Volume */}
        {data.map((c, i) => {
          const pos = c.close >= c.open
          const volH = (c.volume || 0) / maxVol * (CH * 0.18)
          return (
            <rect key={`v${i}`}
              x={xC(i) - cw / 2} y={H - PB - volH}
              width={cw} height={volH}
              fill={pos ? 'var(--green)' : 'var(--red)'} opacity="0.22"
            />
          )
        })}

        {/* MA lines */}
        {maPath(ma20, 'var(--accent)')}
        {maPath(ma50, 'var(--blue)')}

        {/* Candles */}
        {data.map((c, i) => {
          const pos = c.close >= c.open
          const color = pos ? 'var(--green)' : 'var(--red)'
          const cx = xC(i)
          const bodyTop = yP(Math.max(c.open, c.close))
          const bodyH = Math.max(1, Math.abs(yP(c.open) - yP(c.close)))
          return (
            <g key={i} onMouseEnter={() => setTooltip({ ...c, x: cx })} style={{ cursor: 'crosshair' }}>
              <line x1={cx} x2={cx} y1={yP(c.high)} y2={yP(c.low)} stroke={color} strokeWidth="0.9" />
              <rect x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH}
                fill={pos ? color : 'transparent'} stroke={color} strokeWidth="0.8" />
            </g>
          )
        })}

        {/* Date labels */}
        {data.map((c, i) => i % 12 === 0 ? (
          <text key={i} x={xC(i)} y={H - PB + 12}
            textAnchor="middle" fill="var(--muted)" fontSize="8" fontFamily="'DM Mono', monospace">
            {c.date.slice(5)}
          </text>
        ) : null)}

        {/* Crosshair */}
        {tooltip && (
          <line x1={tooltip.x} x2={tooltip.x} y1={PT} y2={H - PB}
            stroke="var(--muted)" strokeWidth="1" strokeDasharray="3,3" />
        )}

        {/* MA legend */}
        <rect x={PL} y={PT - 1} width={28} height={2} fill="var(--accent)" opacity="0.9" />
        <text x={PL + 32} y={PT} dominantBaseline="middle" fill="var(--muted)" fontSize="8" fontFamily="'DM Mono', monospace">MA20</text>
        <rect x={PL + 68} y={PT - 1} width={28} height={2} fill="var(--blue)" opacity="0.9" />
        <text x={PL + 100} y={PT} dominantBaseline="middle" fill="var(--muted)" fontSize="8" fontFamily="'DM Mono', monospace">MA50</text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 11, fontFamily: "'DM Mono', monospace",
          lineHeight: 1.9, pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{tooltip.date}</div>
          <div>O <span style={{ color: 'var(--muted)' }}>${tooltip.open?.toFixed(2)}</span></div>
          <div>H <span style={{ color: 'var(--green)' }}>${tooltip.high?.toFixed(2)}</span></div>
          <div>L <span style={{ color: 'var(--red)' }}>${tooltip.low?.toFixed(2)}</span></div>
          <div>C <span style={{ color: tooltip.close >= tooltip.open ? 'var(--green)' : 'var(--red)' }}>${tooltip.close?.toFixed(2)}</span></div>
          <div>V <span style={{ color: 'var(--muted)' }}>{((tooltip.volume || 0) / 1e6).toFixed(2)}M</span></div>
        </div>
      )}
    </div>
  )
}
