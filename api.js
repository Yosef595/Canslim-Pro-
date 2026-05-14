const PROXY = 'https://query1.finance.yahoo.com/v8/finance/chart/'

export async function fetchQuote(ticker) {
  const url = `${PROXY}${ticker}?interval=1d&range=1y&includePrePost=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`)
  const json = await res.json()
  const result = json.chart.result[0]
  const meta = result.meta
  const timestamps = result.timestamp || []
  const q = result.indicators.quote[0]
  const adj = result.indicators.adjclose?.[0]?.adjclose || q.close

  const candles = timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    open: q.open[i], high: q.high[i], low: q.low[i],
    close: q.close[i], adjclose: adj[i], volume: q.volume[i],
  })).filter(c => c.close != null && c.high != null)

  return {
    ticker,
    price: meta.regularMarketPrice,
    prevClose: meta.previousClose || meta.chartPreviousClose,
    name: meta.longName || meta.shortName || ticker,
    candles,
  }
}

// Weighted RS score vs benchmark (Nasdaq/QQQ)
// 40% weight on most recent 3mo, 20% each on 6/9/12mo
export function calcRSScore(stockCandles, benchCandles) {
  const periods = [[63, 0.40], [126, 0.20], [189, 0.20], [252, 0.20]]
  let score = 0, totalW = 0
  for (const [days, w] of periods) {
    const sn = stockCandles.length, bn = benchCandles.length
    if (sn >= days && bn >= days) {
      const sr = stockCandles[sn-1].adjclose / stockCandles[sn-days].adjclose - 1
      const br = benchCandles[bn-1].adjclose / benchCandles[bn-days].adjclose - 1
      score += (sr - br) * w
      totalW += w
    }
  }
  return totalW > 0 ? score / totalW : 0
}

// Rank raw scores into 1-99 percentile ratings
export function assignRSRatings(rawScores) {
  const sorted = [...rawScores].sort((a, b) => a.raw - b.raw)
  const n = sorted.length
  const ratings = {}
  sorted.forEach((s, i) => {
    ratings[s.ticker] = Math.max(1, Math.min(99, Math.round(1 + (i / (n - 1)) * 98)))
  })
  return ratings
}

export function scoreStock(data, rsRating, benchCandles) {
  const { candles, price, prevClose } = data
  if (!candles || candles.length < 50) return { score: 0, criteria: {} }

  const closes = candles.map(c => c.adjclose || c.close)
  const vols = candles.map(c => c.volume || 0)
  const n = closes.length

  const ma = days => closes.slice(-days).reduce((a, b) => a + b, 0) / days
  const ma50  = n >= 50  ? ma(50)  : null
  const ma150 = n >= 150 ? ma(150) : null
  const ma200 = n >= 200 ? ma(200) : null
  const ma200_6mo = n >= 200 ? closes.slice(-200, -150).reduce((a, b) => a + b, 0) / 50 : null

  const high52 = Math.max(...candles.slice(-252).map(c => c.high))
  const pctFromHigh = ((high52 - price) / high52 * 100)

  const vol5  = vols.slice(-5).reduce((a, b) => a + b, 0) / 5
  const vol20 = vols.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volRatio = vol20 > 0 ? vol5 / vol20 * 100 : 100

  const last10 = closes.slice(-10)
  const tightRange = (Math.max(...last10) - Math.min(...last10)) / Math.min(...last10) * 100

  const stage2 = ma50 && ma150 && ma200 && ma200_6mo
    ? price > ma50 && ma50 > ma150 && ma150 > ma200 && ma200 > ma200_6mo
    : false

  const bn = benchCandles.length
  const benchAbove200 = bn >= 200
    ? benchCandles[bn-1].adjclose > benchCandles.slice(-200).reduce((a, c) => a + c.adjclose, 0) / 200
    : true

  const rsLineRising = bn >= 20 && n >= 20
    ? (closes[n-1] / benchCandles[bn-1].adjclose) > (closes[n-20] / benchCandles[bn-20].adjclose)
    : false

  const lastVol = vols[vols.length - 1] || 0
  const changePct = prevClose ? (price - prevClose) / prevClose * 100 : 0

  const criteria = {
    'N — Near 52w high':         { pass: pctFromHigh <= 15,   detail: `${pctFromHigh.toFixed(1)}% from high` },
    'S — Stage 2 uptrend':       { pass: stage2,               detail: stage2 ? `$${price.toFixed(0)} > MA50 > MA150 > MA200` : 'Not confirmed' },
    'L — RS rating ≥90':         { pass: rsRating >= 90,       detail: `${rsRating}${rsRating >= 90 ? ' ✓' : ' (need ≥90)'}` },
    'L — RS line rising':        { pass: rsLineRising,          detail: rsLineRising ? 'Rising vs Nasdaq' : 'Flat or falling' },
    'M — Market direction':      { pass: benchAbove200,         detail: benchAbove200 ? 'Nasdaq above 200MA' : 'Below 200MA — caution' },
    'VCP — Volume drying up':    { pass: volRatio <= 70,        detail: `${volRatio.toFixed(0)}% of 20d avg` },
    'VCP — Tight consolidation': { pass: tightRange <= 8,       detail: `${tightRange.toFixed(1)}% range last 10d` },
    'VCP — Breakout volume':     { pass: lastVol > vol20 * 1.5, detail: `${(lastVol/1e6).toFixed(1)}M vs avg ${(vol20/1e6).toFixed(1)}M` },
  }

  const score = Object.values(criteria).filter(c => c.pass).length
  return { score, criteria, changePct, ma50, ma150, ma200 }
}
