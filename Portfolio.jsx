import s from './Portfolio.module.css'

function getSignal(item) {
  if (item.currentPrice <= item.stopLoss) return { label: '⛔ Sell — stop hit',   color: 'var(--red)',    urgent: true }
  if (item.currentPrice >= item.target)   return { label: '🎯 Sell — target hit', color: 'var(--green)',  urgent: true }
  const pct = (item.currentPrice - item.entryPrice) / item.entryPrice * 100
  if (pct >= 15) return { label: '✂️ Trim position', color: 'var(--accent)', urgent: false }
  return { label: '✅ Hold', color: 'var(--blue)', urgent: false }
}

export default function Portfolio({ portfolio, setPortfolio, onGoToPicks }) {
  const save = (p) => {
    setPortfolio(p)
    localStorage.setItem('canslim_port', JSON.stringify(p))
  }

  const remove = (id) => save(portfolio.filter(x => x.id !== id))

  const totalPnl = portfolio.reduce((sum, p) => sum + (p.currentPrice - p.entryPrice) * p.shares, 0)
  const urgent = portfolio.filter(p => getSignal(p).urgent).length

  if (!portfolio.length) return (
    <div className={s.empty}>
      <div className={s.emptyIcon}>📋</div>
      <div className={s.emptyTitle}>No positions tracked yet</div>
      <div className={s.emptySub}>Go to Today's Picks, click a stock, and hit "Add to portfolio"</div>
      <button className={s.emptyBtn} onClick={onGoToPicks}>View today's picks</button>
    </div>
  )

  return (
    <div>
      <div className={s.statsRow}>
        {[
          { label: 'Positions',      val: portfolio.length,                                        color: 'var(--text)' },
          { label: 'Total P&L',      val: `${totalPnl >= 0 ? '+' : ''}$${Math.round(totalPnl).toLocaleString()}`, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Action needed',  val: urgent,                                                  color: urgent ? 'var(--accent)' : 'var(--text)' },
        ].map((st, i) => (
          <div className={s.stat} key={i}>
            <div className={s.statLabel}>{st.label}</div>
            <div className={s.statVal} style={{ color: st.color }}>{st.val}</div>
          </div>
        ))}
      </div>

      {portfolio.map(item => {
        const pnl = (item.currentPrice - item.entryPrice) * item.shares
        const pnlPct = (item.currentPrice - item.entryPrice) / item.entryPrice * 100
        const sig = getSignal(item)
        const distStop = ((item.currentPrice - item.stopLoss) / item.currentPrice * 100).toFixed(1)
        const distTarget = ((item.target - item.currentPrice) / item.currentPrice * 100).toFixed(1)

        return (
          <div className={s.posCard} key={item.id}
            style={{ borderColor: sig.urgent ? sig.color + '55' : 'var(--border)' }}>
            <div className={s.posTop}>
              <div>
                <div className={s.posTicker}>
                  {item.ticker}
                  <span className={s.signal} style={{ color: sig.color, borderColor: sig.color + '44', background: sig.color + '15',
                    animation: sig.urgent ? 'pulse 1.8s infinite' : 'none' }}>
                    {sig.label}
                  </span>
                </div>
                <div className={s.posSub}>{item.name} · {item.shares} shares @ ${item.entryPrice.toFixed(2)} · {item.boughtAt}</div>
              </div>
              <div className={s.posRight}>
                <div className={s.posPrice}>${item.currentPrice.toFixed(2)}</div>
                <div style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: "'DM Mono'", fontSize: 13 }}>
                  {pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                </div>
              </div>
            </div>

            <div className={s.levels}>
              {[
                { label: 'Entry',     val: `$${item.entryPrice.toFixed(2)}`, color: 'var(--accent)', sub: '' },
                { label: 'Stop loss', val: `$${item.stopLoss.toFixed(2)}`,  color: 'var(--red)',    sub: `-${distStop}% away` },
                { label: 'Target',    val: `$${item.target.toFixed(2)}`,    color: 'var(--green)',  sub: `+${distTarget}% away` },
                { label: 'RS rating', val: item.rs,                          color: item.rs >= 90 ? 'var(--green)' : 'var(--accent)', sub: '' },
              ].map((l, i) => (
                <div className={s.levelBox} key={i}>
                  <div className={s.levelLabel}>{l.label}</div>
                  <div className={s.levelVal} style={{ color: l.color }}>{l.val}</div>
                  {l.sub && <div className={s.levelSub}>{l.sub}</div>}
                </div>
              ))}
            </div>

            {sig.urgent && (
              <div className={s.alert} style={{ background: sig.color + '15', borderColor: sig.color + '44', color: sig.color }}>
                <strong>Action required: </strong>
                {sig.color === 'var(--red)'
                  ? 'Your stop loss has been hit. Exit the position to protect your capital.'
                  : 'Price has reached your profit target. Consider taking full or partial profits.'}
              </div>
            )}

            <button className={s.removeBtn} onClick={() => remove(item.id)}>Remove position</button>
          </div>
        )
      })}
    </div>
  )
}
