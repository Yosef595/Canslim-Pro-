import { useState, useEffect } from 'react'
import CandleChart from './CandleChart.jsx'
import Portfolio from './Portfolio.jsx'
import { fetchQuote, calcRSScore, assignRSRatings, scoreStock } from './api.js'

const TICKERS = [
  'NVDA','AAPL','MSFT','META','AMZN','GOOGL','CRWD','AXON','CELH','DUOL',
  'PANW','COIN','UBER','DDOG','APP','MELI','TSM','SMCI','ASTS','RKLB',
  'AVGO','NOW','ORCL','CRM','PLTR','ANET','WDAY','SNOW','MDB','NET',
]
const BENCH = 'QQQ'

export default function App() {
  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState('picks')
  const [status, setStatus] = useState('loading') // loading | done | error
  const [error, setError] = useState('')
  const [picks, setPicks] = useState([])
  const [selected, setSelected] = useState(null)
  const [benchAbove200, setBenchAbove200] = useState(true)
  const [portfolio, setPortfolio] = useState(() => {
    try { return JSON.parse(localStorage.getItem('canslim_port') || '[]') } catch { return [] }
  })
  const [addingTo, setAddingTo] = useState(null)
  const [buyForm, setBuyForm] = useState({ shares: '', price: '' })
  const [loadProgress, setLoadProgress] = useState(0)

  useEffect(() => {
    document.body.className = dark ? '' : 'light'
  }, [dark])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setStatus('loading')
    setLoadProgress(0)
    try {
      // Fetch benchmark
      const bench = await fetchQuote(BENCH)
      const bn = bench.candles.length
      const above200 = bn >= 200
        ? bench.candles[bn-1].adjclose > bench.candles.slice(-200).reduce((a,c) => a + c.adjclose, 0) / 200
        : true
      setBenchAbove200(above200)
      setLoadProgress(10)

      // Fetch all tickers with progress
      const results = []
      for (let i = 0; i < TICKERS.length; i++) {
        try {
          const data = await fetchQuote(TICKERS[i])
          results.push(data)
        } catch (e) {
          console.warn(`Skipping ${TICKERS[i]}:`, e.message)
        }
        setLoadProgress(Math.round(10 + (i / TICKERS.length) * 70))
      }

      // Calculate RS ratings
      const rawScores = results.map(s => ({
        ticker: s.ticker,
        raw: calcRSScore(s.candles, bench.candles),
      }))
      const ratings = assignRSRatings(rawScores)
      setLoadProgress(85)

      // Score each stock
      const scored = results.map(s => {
        const rs = ratings[s.ticker] || 1
        const { score, criteria, changePct } = scoreStock(s, rs, bench.candles)
        const pivot  = +(s.price * 1.015).toFixed(2)
        const stop   = +(s.price * 0.91).toFixed(2)
        const target = +(s.price * 1.20).toFixed(2)
        return { ...s, rs, score, criteria, changePct: changePct || 0, pivot, stop, target }
      })

      // Sort by RS rating descending — best stocks first
      scored.sort((a, b) => b.rs - a.rs)
      setPicks(scored)
      setSelected(scored[0] || null)
      setStatus('done')
      setLoadProgress(100)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const confirmBuy = (stock) => {
    const shares = parseFloat(buyForm.shares)
    const price  = parseFloat(buyForm.price)
    if (!shares || !price) return
    const newItem = {
      id: Date.now(), ticker: stock.ticker, name: stock.name,
      shares, entryPrice: price, currentPrice: stock.price,
      stopLoss: stock.stop, target: stock.target, pivot: stock.pivot,
      boughtAt: new Date().toLocaleDateString(), rs: stock.rs,
    }
    const updated = [...portfolio, newItem]
    setPortfolio(updated)
    localStorage.setItem('canslim_port', JSON.stringify(updated))
    setAddingTo(null)
    setBuyForm({ shares: '', price: '' })
    setTab('portfolio')
  }

  // ── STYLES ──
  const surface  = 'var(--surface)'
  const surface2 = 'var(--surface2)'
  const border   = 'var(--border)'
  const muted    = 'var(--muted)'
  const accent   = 'var(--accent)'
  const green    = 'var(--green)'
  const red      = 'var(--red)'
  const blue     = 'var(--blue)'
  const text     = 'var(--text)'

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── HEADER ── */}
      <header style={{
        background: surface, borderBottom: `0.5px solid ${border}`,
        padding: '0 20px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.12em',
            background: `linear-gradient(90deg, ${accent}, ${red})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>CANSLIM.PRO</div>
          <div style={{ width: 1, height: 16, background: border }} />
          <div style={{ fontSize: 11, color: muted }}>
            {status === 'done' ? `${picks.length} stocks · ranked by RS rating` : status === 'loading' ? 'Loading live data…' : 'Error loading data'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: surface2, borderRadius: 8, padding: 3, gap: 2 }}>
            {[['picks', "Today's picks"], ['portfolio', `Portfolio${portfolio.length > 0 ? ` (${portfolio.length})` : ''}`]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: tab === key ? (dark ? '#fff' : '#1c1917') : 'transparent',
                color: tab === key ? (dark ? '#080810' : '#f5f4f0') : muted,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
          <button onClick={() => setDark(d => !d)} style={{
            width: 34, height: 34, borderRadius: 8, border: `0.5px solid ${border}`,
            background: surface2, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{dark ? '☀️' : '🌙'}</button>
          <button onClick={loadData} title="Refresh data" style={{
            width: 34, height: 34, borderRadius: 8, border: `0.5px solid ${border}`,
            background: surface2, cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔄</button>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── LOADING ── */}
        {status === 'loading' && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: muted, marginBottom: 20 }}>
              Fetching live prices from Yahoo Finance…
            </div>
            <div style={{ height: 4, background: surface2, borderRadius: 99, overflow: 'hidden', maxWidth: 300, margin: '0 auto' }}>
              <div style={{ height: '100%', width: `${loadProgress}%`, background: accent, borderRadius: 99, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 10 }}>{loadProgress}%</div>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: `0.5px solid ${red}44`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ color: red, fontWeight: 600, marginBottom: 6 }}>Failed to load live data</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>{error}</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>
              Yahoo Finance may be rate-limiting requests. Try refreshing in 30–60 seconds.
            </div>
            <button onClick={loadData} style={{
              padding: '8px 20px', background: accent, color: '#080810',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>Try again</button>
          </div>
        )}

        {/* ── PICKS TAB ── */}
        {status === 'done' && tab === 'picks' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
              {[
                { label: 'Stocks scanned',  val: picks.length },
                { label: 'Top RS (≥90)',    val: picks.filter(p => p.rs >= 90).length, color: green },
                { label: 'Market',          val: benchAbove200 ? '✅ Uptrend' : '⚠️ Caution', color: benchAbove200 ? green : accent },
              ].map((s, i) => (
                <div key={i} style={{ background: surface, border: `0.5px solid ${border}`, borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'DM Mono', monospace", color: s.color || text }}>{s.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 14, alignItems: 'start' }}>

              {/* Stock list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Ranked by RS rating</div>
                {picks.map((stock, i) => {
                  const active = selected?.ticker === stock.ticker
                  const pos = stock.changePct >= 0
                  return (
                    <div key={stock.ticker} onClick={() => { setSelected(stock); setAddingTo(null) }} style={{
                      background: active ? (dark ? '#1e1e35' : '#fff8ed') : surface,
                      border: `0.5px solid ${active ? accent + '88' : border}`,
                      borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 10, color: muted, fontFamily: "'DM Mono'" }}>#{i+1}</span>
                          <div>
                            <div style={{ fontFamily: "'DM Mono'", fontWeight: 500, fontSize: 14 }}>{stock.ticker}</div>
                            <div style={{ fontSize: 10, color: muted }}>{stock.name.split(' ').slice(0,2).join(' ')}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'DM Mono'", fontSize: 13, fontWeight: 500 }}>${stock.price.toFixed(2)}</div>
                          <div style={{ fontSize: 11, fontFamily: "'DM Mono'", color: pos ? green : red }}>{pos?'+':''}{stock.changePct.toFixed(2)}%</div>
                        </div>
                      </div>
                      {/* RS + Score bars */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        {[
                          { label: 'RS', val: stock.rs, color: stock.rs >= 90 ? green : accent, pct: stock.rs },
                          { label: 'Score', val: `${stock.score}/8`, color: blue, pct: stock.score/8*100 },
                        ].map(b => (
                          <div key={b.label} style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: muted, marginBottom: 2 }}>
                              <span>{b.label}</span><span style={{ color: b.color }}>{b.val}</span>
                            </div>
                            <div style={{ height: 3, background: surface2, borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 99, transition: 'width .5s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Detail panel */}
              {selected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">

                  {/* Header card */}
                  <div style={{ background: surface, border: `0.5px solid ${border}`, borderRadius: 16, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: '.05em', lineHeight: 1 }}>{selected.ticker}</span>
                          <span style={{
                            fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                            background: selected.rs >= 90 ? green+'22' : accent+'22',
                            color: selected.rs >= 90 ? green : accent,
                            border: `0.5px solid ${selected.rs >= 90 ? green+'44' : accent+'44'}`,
                          }}>{selected.rs >= 90 ? '🔥 High conviction' : '👀 Watch'}</span>
                        </div>
                        <div style={{ fontSize: 12, color: muted }}>{selected.name}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                          <span style={{ fontSize: 28, fontWeight: 500, fontFamily: "'DM Mono'" }}>${selected.price.toFixed(2)}</span>
                          <span style={{ fontSize: 14, fontFamily: "'DM Mono'", color: selected.changePct >= 0 ? green : red }}>
                            {selected.changePct >= 0 ? '+' : ''}{selected.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      {/* RS badge */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 36, fontWeight: 500, fontFamily: "'DM Mono'", lineHeight: 1, color: selected.rs >= 90 ? green : accent }}>{selected.rs}</div>
                        <div style={{ fontSize: 9, color: muted, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 3 }}>RS Rating</div>
                        <div style={{ fontSize: 9, color: muted }}>vs Nasdaq</div>
                      </div>
                    </div>

                    {/* Key levels */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 }}>
                      {[
                        { label: 'Buy pivot',  val: selected.pivot,  color: accent, sub: 'Entry point' },
                        { label: 'Stop loss',  val: selected.stop,   color: red,    sub: `-${((selected.price - selected.stop)/selected.price*100).toFixed(1)}% risk` },
                        { label: 'Target',     val: selected.target, color: green,  sub: `+${((selected.target - selected.price)/selected.price*100).toFixed(1)}% reward` },
                      ].map(l => (
                        <div key={l.label} style={{ background: surface2, borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 500, fontFamily: "'DM Mono'", color: l.color, marginTop: 3 }}>${l.val}</div>
                          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{l.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* R/R bar */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: muted, marginBottom: 4 }}>
                        <span>Risk / reward</span>
                        <span style={{ fontFamily: "'DM Mono'", color: accent }}>
                          1 : {((selected.target - selected.price) / (selected.price - selected.stop)).toFixed(1)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
                        <div style={{ flex: selected.price - selected.stop, background: red, opacity: .75 }} />
                        <div style={{ flex: selected.target - selected.price, background: green, opacity: .75 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: muted, marginTop: 3, fontFamily: "'DM Mono'" }}>
                        <span>Stop -{((selected.price - selected.stop)/selected.price*100).toFixed(1)}%</span>
                        <span>Target +{((selected.target - selected.price)/selected.price*100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Candle chart */}
                  <div style={{ background: surface, border: `0.5px solid ${border}`, borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>Daily chart — last 60 sessions</span>
                      <span style={{ fontSize: 10, color: muted }}>
                        MA20 <span style={{ color: accent }}>■</span> &nbsp;
                        MA50 <span style={{ color: blue }}>■</span>
                      </span>
                    </div>
                    <CandleChart candles={selected.candles} height={240} />
                  </div>

                  {/* Criteria */}
                  <div style={{ background: surface, border: `0.5px solid ${border}`, borderRadius: 16, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>CAN SLIM + VCP breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                      {Object.entries(selected.criteria || {}).map(([k, v]) => (
                        <div key={k} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '5px 0', borderBottom: `0.5px solid ${border}`, fontSize: 12, gap: 8,
                        }}>
                          <span style={{ color: muted }}>{v.pass ? '✅' : '❌'} {k}</span>
                          <span style={{ fontFamily: "'DM Mono'", fontSize: 11, color: v.pass ? green : red, whiteSpace: 'nowrap' }}>{v.detail}</span>
                        </div>
                      ))}
                    </div>

                    {/* Buy form */}
                    {addingTo === selected.ticker ? (
                      <div style={{ marginTop: 14, background: surface2, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginBottom: 10 }}>Log your buy for {selected.ticker}</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          {['shares', 'price'].map(field => (
                            <input key={field} type="number" placeholder={field === 'shares' ? '# Shares' : `Buy price $${selected.price.toFixed(2)}`}
                              value={buyForm[field]}
                              onChange={e => setBuyForm(b => ({ ...b, [field]: e.target.value }))}
                              style={{
                                flex: 1, background: surface, border: `0.5px solid ${border}`, borderRadius: 8,
                                padding: '9px 12px', color: text, fontSize: 13, fontFamily: "'DM Mono'",
                              }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => confirmBuy(selected)} style={{
                            flex: 1, background: `linear-gradient(135deg, ${accent}, #f97316)`,
                            color: '#080810', border: 'none', borderRadius: 8, padding: 10,
                            fontWeight: 700, fontSize: 12, cursor: 'pointer',
                          }}>Confirm buy</button>
                          <button onClick={() => setAddingTo(null)} style={{
                            flex: 1, background: 'transparent', border: `0.5px solid ${border}`,
                            borderRadius: 8, padding: 10, color: muted, fontSize: 12, cursor: 'pointer',
                          }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTo(selected.ticker)} style={{
                        width: '100%', marginTop: 14,
                        background: `linear-gradient(135deg, ${accent}, #f97316)`,
                        color: '#080810', border: 'none', borderRadius: 10, padding: 12,
                        fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '.05em',
                      }}>+ Add to portfolio</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, fontSize: 11, color: muted, lineHeight: 1.7, padding: '10px 14px', background: surface, borderRadius: 10, border: `0.5px solid ${border}` }}>
              RS ratings are calculated by comparing each stock's price performance vs the Nasdaq (QQQ) — 40% weight on the most recent 3 months, 20% each on 6/9/12 month periods — then ranked 1–99 against all stocks in the universe. Prices are live from Yahoo Finance. Not financial advice.
            </div>
          </>
        )}

        {/* ── PORTFOLIO TAB ── */}
        {tab === 'portfolio' && (
          <Portfolio
            portfolio={portfolio}
            setPortfolio={setPortfolio}
            onGoToPicks={() => setTab('picks')}
          />
        )}
      </div>
    </div>
  )
}
