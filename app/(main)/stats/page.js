'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LogoutButton from '@/app/components/LogoutButton'

function calcPoints(resultHome, resultAway, betHome, betAway) {
  if (betHome === resultHome && betAway === resultAway) return 3
  if (Math.sign(betHome - betAway) === Math.sign(resultHome - resultAway)) return 1
  return 0
}

function computeStats(users, matches, bets) {
  const activeUserIds = new Set(users.map(u => u.id))
  bets = bets.filter(b => activeUserIds.has(b.user_id))

  const matchById = Object.fromEntries(matches.map(m => [m.id, m]))
  const finishedMatchIds = new Set(
    matches.filter(m => m.result_home !== null).map(m => m.id)
  )

  // Majority scoreline per match (used by Maverick/Sheep and Underrated/Overrated)
  const matchMajority = {}
  for (const m of matches) {
    const mb = bets.filter(b => b.match_id === m.id)
    if (!mb.length) continue
    const counts = {}
    for (const b of mb) {
      const k = `${b.bet_home}-${b.bet_away}`
      counts[k] = (counts[k] || 0) + 1
    }
    matchMajority[m.id] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  // --- Player stats ---

  const totalGoals = users.map(u => ({
    user: u,
    v: bets.filter(b => b.user_id === u.id).reduce((s, b) => s + b.bet_home + b.bet_away, 0),
    hasBets: bets.some(b => b.user_id === u.id),
  }))
  const legendaryOptimist = [...totalGoals].sort((a, b) => b.v - a.v)[0]
  const dukeOfDullness = [...totalGoals].filter(t => t.hasBets).sort((a, b) => a.v - b.v)[0]

  const diplomatOfDraws = users.map(u => ({
    user: u,
    v: bets.filter(b => b.user_id === u.id && b.bet_home === b.bet_away).length,
  })).sort((a, b) => b.v - a.v)[0]

  const highStakesHero = users.map(u => ({
    user: u,
    v: bets.filter(b => b.user_id === u.id && Math.abs(b.bet_home - b.bet_away) >= 3).length,
  })).sort((a, b) => b.v - a.v)[0]

  const majorityAgreement = users.map(u => {
    const ub = bets.filter(b => b.user_id === u.id)
    if (!ub.length) return { user: u, pct: 50 }
    const matched = ub.filter(b => matchMajority[b.match_id] === `${b.bet_home}-${b.bet_away}`).length
    return { user: u, pct: Math.round(matched / ub.length * 100) }
  })
  const maverick = [...majorityAgreement].sort((a, b) => a.pct - b.pct)[0]
  const sheep    = [...majorityAgreement].sort((a, b) => b.pct - a.pct)[0]

  const unluckyLoser = users.map(u => ({
    user: u,
    v: bets.filter(b => {
      if (b.user_id !== u.id || !finishedMatchIds.has(b.match_id)) return false
      const m = matchById[b.match_id]
      if (Math.sign(b.bet_home - b.bet_away) === Math.sign(m.result_home - m.result_away)) return false
      return Math.abs(b.bet_home - m.result_home) === 1 && Math.abs(b.bet_away - m.result_away) === 1
    }).length,
  })).sort((a, b) => b.v - a.v)[0]

  // WTF — highest total distance from actual result
  let wtf = null
  for (const b of bets) {
    if (!finishedMatchIds.has(b.match_id)) continue
    const m = matchById[b.match_id]
    const dist = Math.abs(b.bet_home - m.result_home) + Math.abs(b.bet_away - m.result_away)
    if (!wtf || dist > wtf.dist) wtf = { bet: b, match: m, dist }
  }
  const wtfUser = wtf ? users.find(u => u.id === wtf.bet.user_id) : null

  // --- Team stats ---

  const teamNames = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]))]

  const winRates = teamNames.map(team => {
    let wins = 0, total = 0
    for (const m of matches) {
      const isHome = m.home_team === team
      const isAway = m.away_team === team
      if (!isHome && !isAway) continue
      const mb = bets.filter(b => b.match_id === m.id)
      total += mb.length
      for (const b of mb) {
        if (isHome && b.bet_home > b.bet_away) wins++
        if (isAway && b.bet_away > b.bet_home) wins++
      }
    }
    return { team, rate: total > 0 ? wins / total : 0, total }
  }).filter(t => t.total > 0)

  const favourite     = [...winRates].sort((a, b) => b.rate - a.rate)[0]
  const nobodysDarling = [...winRates].sort((a, b) => a.rate - b.rate)[0]

  // Underrated/Overrated — gap between actual avg pts and expected avg pts
  // Expected = avg pts all players would have earned if majority prediction had been the result
  // Actual   = avg pts actually earned
  const teamGaps = teamNames.map(team => {
    let totalGap = 0, n = 0
    for (const m of matches) {
      if (m.result_home === null) continue
      const isHome = m.home_team === team
      const isAway = m.away_team === team
      if (!isHome && !isAway) continue
      const mb = bets.filter(b => b.match_id === m.id)
      if (!mb.length) continue
      const majKey = matchMajority[m.id]
      if (!majKey) continue
      const [mh, ma] = majKey.split('-').map(Number)
      const expected = mb.reduce((s, b) => s + calcPoints(mh, ma, b.bet_home, b.bet_away), 0) / mb.length
      const actual   = mb.reduce((s, b) => s + calcPoints(m.result_home, m.result_away, b.bet_home, b.bet_away), 0) / mb.length
      totalGap += actual - expected
      n++
    }
    return { team, gap: n > 0 ? totalGap / n : 0, n }
  }).filter(t => t.n > 0)

  const underrated = [...teamGaps].sort((a, b) => b.gap - a.gap)[0]
  const overrated  = [...teamGaps].sort((a, b) => a.gap - b.gap)[0]

  // --- Match stats ---

  let leastConsensus = null, maxUnique = -1
  let mostConsensus  = null, maxShare  = -1

  for (const m of matches) {
    const mb = bets.filter(b => b.match_id === m.id)
    if (mb.length < 3) continue
    const counts = {}
    for (const b of mb) {
      const k = `${b.bet_home}-${b.bet_away}`
      counts[k] = (counts[k] || 0) + 1
    }
    const unique   = Object.keys(counts).length
    const topShare = Math.max(...Object.values(counts)) / mb.length
    if (unique   > maxUnique) { maxUnique = unique;   leastConsensus = { match: m, unique } }
    if (topShare > maxShare)  { maxShare  = topShare; mostConsensus  = { match: m, share: topShare } }
  }

  const fmt = (team1, team2) => `${team1} vs ${team2}`

  return {
    playerStats: [
      legendaryOptimist && {
        emoji: '🚀', title: 'Legendary Optimist', description: 'Predicted the most total goals',
        winner: legendaryOptimist.user.alias, value: `${legendaryOptimist.v} goals`,
      },
      dukeOfDullness && {
        emoji: '😴', title: 'Duke of Dullness', description: 'Predicted the fewest total goals',
        winner: dukeOfDullness.user.alias, value: `${dukeOfDullness.v} goals`,
      },
      diplomatOfDraws && {
        emoji: '🤝', title: 'Diplomat of Draws', description: 'Predicted the most draws',
        winner: diplomatOfDraws.user.alias, value: `${diplomatOfDraws.v} draws`,
      },
      highStakesHero && {
        emoji: '💥', title: 'High-stakes Hero', description: 'Most bets with a margin of 3+ goals',
        winner: highStakesHero.user.alias, value: `${highStakesHero.v} bets`,
      },
      maverick && {
        emoji: '🐺', title: 'The Maverick', description: 'Least often agreed with the majority',
        winner: maverick.user.alias, value: `${maverick.pct}% match`,
      },
      sheep && {
        emoji: '🐑', title: 'The Sheep', description: 'Most often agreed with the majority',
        winner: sheep.user.alias, value: `${sheep.pct}% match`,
      },
      {
        emoji: '💔', title: 'Unlucky Loser', description: 'Most bets just one goal off the result',
        winner: finishedMatchIds.size > 0 ? unluckyLoser?.user.alias ?? null : null,
        value:  finishedMatchIds.size > 0 ? `${unluckyLoser?.v} times` : null,
      },
      {
        emoji: '🤯', title: 'WTF', description: 'The single wildest bet',
        winner: wtfUser?.alias ?? null,
        value: wtf ? `Predicted ${wtf.bet.bet_home}−${wtf.bet.bet_away} · actual ${wtf.match.result_home}−${wtf.match.result_away}` : null,
        match: wtf ? fmt(wtf.match.home_team, wtf.match.away_team) : null,
      },
    ].filter(Boolean),

    teamStats: [
      favourite && {
        emoji: '👑', title: 'The Favourite', description: 'Most players backed them to win',
        team: favourite.team, value: `${Math.round(favourite.rate * 100)}%`,
      },
      nobodysDarling && {
        emoji: '👻', title: "Nobody's Darling", description: 'Fewest players backed them to win',
        team: nobodysDarling.team, value: `${Math.round(nobodysDarling.rate * 100)}%`,
      },
      {
        emoji: '💎', title: 'The Underrated', description: 'Outperformed what players predicted',
        team:  underrated?.team ?? null,
        value: underrated ? `${underrated.gap >= 0 ? '+' : ''}${underrated.gap.toFixed(1)} pts` : null,
      },
      {
        emoji: '📉', title: 'The Overrated', description: 'Backed heavily — failed to deliver',
        team:  overrated?.team ?? null,
        value: overrated ? `${overrated.gap.toFixed(1)} pts` : null,
      },
    ].filter(Boolean),

    matchStats: [
      {
        emoji: '🙃', title: 'Least Consensus', detail: 'Nobody could agree on this one',
        match: leastConsensus ? fmt(leastConsensus.match.home_team, leastConsensus.match.away_team) : null,
        badge: leastConsensus ? `${leastConsensus.unique} unique bets` : null,
      },
      {
        emoji: '😊', title: 'Most Consensus', detail: 'Everyone saw this one coming',
        match: mostConsensus ? fmt(mostConsensus.match.home_team, mostConsensus.match.away_team) : null,
        badge: mostConsensus ? `${Math.round(mostConsensus.share * 100)}% agreed` : null,
      },
    ].filter(Boolean),
  }
}

const sectionLabel = {
  fontSize: 10,
  color: '#999',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
}


export default function StatsPage() {
  const [statsVisible, setStatsVisible] = useState(false)
  const [playerStats, setPlayerStats] = useState([])
  const [teamStats, setTeamStats]     = useState([])
  const [matchStats, setMatchStats]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  async function fetchAllBets() {
    const PAGE = 1000
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('bets')
        .select('id, match_id, user_id, bet_home, bet_away')
        .range(from, from + PAGE - 1)
      if (error) return { data: null, error }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return { data: all, error: null }
  }

  async function load() {
    setLoading(true)
    setError(null)

    const [
      { data: stageData, error: e1 },
      { data: userData,  error: e2 },
      { data: matchData, error: e3 },
      { data: betData,   error: e4 },
    ] = await Promise.all([
      supabase.from('stages').select('stage, is_open'),
      supabase.from('users').select('id, alias').eq('is_active', true),
      supabase.from('matches').select('id, stage, home_team, away_team, result_home, result_away'),
      fetchAllBets(),
    ])

    if (e1 || e2 || e3 || e4) {
      setError('Could not load stats — please refresh the page.')
      setLoading(false)
      return
    }

    const lockedStageNames = new Set(
      (stageData || []).filter(s => !s.is_open).map(s => s.stage)
    )
    const lockedMatches = (matchData || []).filter(m => lockedStageNames.has(m.stage))
    setStatsVisible(lockedMatches.length > 0)

    const lockedMatchIds = new Set(lockedMatches.map(m => m.id))
    const threshold = lockedMatches.length * 0.5
    const eligibleUsers = (userData || []).filter(u =>
      (betData || []).filter(b => b.user_id === u.id && lockedMatchIds.has(b.match_id)).length >= threshold
    )

    const stats = computeStats(eligibleUsers, lockedMatches, betData || [])
    setPlayerStats(stats.playerStats)
    setTeamStats(stats.teamStats)
    setMatchStats(stats.matchStats)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#f4f5f7' }}>

      {/* Header */}
      <div className="flex-shrink-0" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">🏅</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Awards</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="text-xs px-3 py-1 rounded-full"
              style={{ color: 'rgba(255,255,255,0.75)', border: '0.5px solid rgba(255,255,255,0.3)' }}
            >
              ↻ Refresh
            </button>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pt-3" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <p className="text-sm text-gray-400 text-center mt-8">Loading...</p>
        ) : error ? (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        ) : (
          <>
            {/* Section 1 — Player stats */}
            <div className="flex items-center justify-between px-1 mb-2">
              <p style={sectionLabel}>🧑‍🤝‍🧑 Player awards</p>
              {!statsVisible && <span style={{ fontSize: 10, color: '#aaa' }}>Available once a stage is locked</span>}
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {playerStats.map(({ emoji, title, description, winner, value, match }) => (
                <div key={title} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{title}</p>
                    <p style={{ fontSize: 11, color: '#666' }}>{description}</p>
                  </div>
                  {statsVisible && winner && (
                    <div className="shrink-0 flex flex-col items-end">
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{winner}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>{value}</span>
                      {match && <span style={{ fontSize: 11, color: '#666' }}>{match}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Section 2 — Team stats */}
            <div className="flex items-center justify-between px-1 mt-5 mb-2">
              <p style={sectionLabel}>⚽ Team awards</p>
              {!statsVisible && <span style={{ fontSize: 10, color: '#aaa' }}>Available once a stage is locked</span>}
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {teamStats.map(({ emoji, title, description, team, value }) => (
                <div key={title} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{title}</p>
                    <p style={{ fontSize: 11, color: '#666' }}>{description}</p>
                  </div>
                  {statsVisible && team && (
                    <div className="shrink-0 flex flex-col items-end">
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{team}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>{value}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Section 3 — Match stats */}
            <div className="flex items-center justify-between px-1 mt-5 mb-2">
              <p style={sectionLabel}>⚡ Match awards</p>
              {!statsVisible && <span style={{ fontSize: 10, color: '#aaa' }}>Available once a stage is locked</span>}
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {matchStats.map(({ emoji, title, badge, match, detail }) => (
                <div key={title} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{title}</p>
                    <p style={{ fontSize: 11, color: '#666' }}>{detail}</p>
                  </div>
                  {statsVisible && match && (
                    <div className="shrink-0 flex flex-col items-end">
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0a5c45' }}>{match}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#666' }}>{badge}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
