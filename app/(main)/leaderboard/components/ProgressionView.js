'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts'

const MAX_SELECTED = 8
const COLORS = ['#0a5c45', '#1D9E75', '#5DCAA5', '#BA7517', '#993C1D', '#412402', '#3B6EA5', '#7B4FA6']
const STAGE_ORDER = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final']
const STAGE_SHORT = { Group: 'GROUP', R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', Final: 'F' }
const PX_PER_MATCH = 16

// Must stay in sync with calcPoints in MatchCard.js
function calcPoints(match, betHome, betAway) {
  if (match.result_home === null || match.result_away === null) return null
  if (betHome === match.result_home && betAway === match.result_away) return 3
  const resultWinner = Math.sign(match.result_home - match.result_away)
  const betWinner = Math.sign(betHome - betAway)
  if (resultWinner === betWinner) return 1
  return 0
}

export default function ProgressionView({ allUsers, currentUserId }) {
  const [matches, setMatches] = useState([])
  const [bets, setBets] = useState([])
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const scrollRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    async function fetchMatches() {
      const { data } = await supabase
        .from('matches')
        .select('id, stage, match_time, result_home, result_away')
        .order('match_time')
      setMatches(data || [])
      setLoadingMatches(false)
    }
    fetchMatches()
  }, [])

  // Load saved selection once allUsers is populated (runs once on first non-empty allUsers)
  useEffect(() => {
    if (initialized.current || !allUsers || allUsers.length === 0) return
    initialized.current = true
    const userIds = allUsers.map(u => u.id)
    try {
      const saved = JSON.parse(localStorage.getItem('leaderboardProgressionSelected') || '[]')
      const valid = saved.filter(id => userIds.includes(id)).slice(0, MAX_SELECTED)
      setSelected(valid)
    } catch {
      setSelected([])
    }
  }, [allUsers])

  // Fetch bets for selected users only
  useEffect(() => {
    if (selected.length === 0) {
      setBets([])
      return
    }
    async function fetchBets() {
      const { data } = await supabase
        .from('bets')
        .select('user_id, match_id, bet_home, bet_away')
        .in('user_id', selected)
      setBets(data || [])
    }
    fetchBets()
  }, [selected])

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current && !searchRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Scroll to end of current stage when data first appears or matches load
  useEffect(() => {
    if (!scrollRef.current || matches.length === 0) return
    const fraction = (scrollTargetIdx + 1) / matches.length
    const target = fraction * scrollRef.current.scrollWidth - scrollRef.current.clientWidth + 32
    scrollRef.current.scrollLeft = Math.max(0, target)
    setShowLeftFade(scrollRef.current.scrollLeft > 4)
  }, [selected.length > 0 ? 'has-data' : 'no-data', matches.length])

  function handleScroll() {
    if (scrollRef.current) setShowLeftFade(scrollRef.current.scrollLeft > 4)
  }

  function addUser(id) {
    if (selected.includes(id) || selected.length >= MAX_SELECTED) return
    const updated = [...selected, id]
    setSelected(updated)
    try { localStorage.setItem('leaderboardProgressionSelected', JSON.stringify(updated)) } catch {}
    setQuery('')
    setOpen(false)
  }

  function removeUser(id) {
    const updated = selected.filter(uid => uid !== id)
    setSelected(updated)
    try { localStorage.setItem('leaderboardProgressionSelected', JSON.stringify(updated)) } catch {}
  }

  // User lookup map and rank map (by current total_points)
  const userById = {}
  for (const u of (allUsers || [])) userById[u.id] = u

  const rankMap = {}
  const sortedByPoints = [...(allUsers || [])].sort((a, b) => b.total_points - a.total_points)
  let currentRank = 1
  sortedByPoints.forEach((u, idx) => {
    if (idx > 0 && u.total_points !== sortedByPoints[idx - 1].total_points) currentRank = idx + 1
    rankMap[u.id] = currentRank
  })

  // Bet lookup: { [userId]: { [matchId]: { bet_home, bet_away } } }
  const betMap = {}
  for (const b of bets) {
    if (!betMap[b.user_id]) betMap[b.user_id] = {}
    betMap[b.user_id][b.match_id] = { bet_home: b.bet_home, bet_away: b.bet_away }
  }

  // Build cumulative chart data in kickoff order
  const chartData = []
  const stageFirstIndex = {}
  const runningTotals = {}
  for (const uid of selected) runningTotals[uid] = 0

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    if (!(match.stage in stageFirstIndex)) stageFirstIndex[match.stage] = i

    const row = {
      i,
      date: new Date(match.match_time).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', timeZone: 'Europe/Oslo',
      }),
      stage: match.stage,
    }

    for (const uid of selected) {
      if (match.result_home !== null && match.result_away !== null) {
        const userBet = betMap[uid]?.[match.id]
        const pts = userBet ? (calcPoints(match, userBet.bet_home, userBet.bet_away) ?? 0) : 0
        runningTotals[uid] += pts
      }
      row[uid] = runningTotals[uid]
    }

    chartData.push(row)
  }

  // Stage ranges for ReferenceArea bands (start/end match index per stage)
  const stageRanges = STAGE_ORDER
    .map((stage, orderIdx) => {
      if (!(stage in stageFirstIndex)) return null
      const start = stageFirstIndex[stage]
      const nextStage = STAGE_ORDER.slice(orderIdx + 1).find(s => s in stageFirstIndex)
      const end = nextStage ? stageFirstIndex[nextStage] - 1 : matches.length - 1
      return { stage, start, end, orderIdx }
    })
    .filter(Boolean)

  const chartWidth = Math.max(matches.length * PX_PER_MATCH, 320)

  // Scroll target: end of the last stage that has at least one played match
  const lastPlayedIdx = (() => {
    let idx = -1
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].result_home !== null) idx = i
    }
    return idx
  })()
  const currentStageRange = stageRanges.find(r => r.start <= lastPlayedIdx && lastPlayedIdx <= r.end)
  const scrollTargetIdx = currentStageRange ? currentStageRange.end : Math.max(lastPlayedIdx, 0)

  const filteredUsers = (allUsers || [])
    .filter(u => !selected.includes(u.id) && u.alias.toLowerCase().includes(query.toLowerCase()))

  if (loadingMatches) {
    return <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 32 }}>Loading...</p>
  }

  return (
    <div>
      {/* Search box */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <input
          ref={searchRef}
          type="text"
          placeholder={selected.length >= MAX_SELECTED ? 'Max 8 players selected' : 'Search players...'}
          disabled={selected.length >= MAX_SELECTED}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (selected.length < MAX_SELECTED) setOpen(true) }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #e0e0e0',
            fontSize: 16,
            outline: 'none',
            background: selected.length >= MAX_SELECTED ? '#f5f5f5' : '#fff',
            color: '#333',
          }}
        />
        {open && filteredUsers.length > 0 && selected.length < MAX_SELECTED && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: 10,
              marginTop: 4,
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => addUser(u.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '0.5px solid #f0f0f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#222' }}>
                  {u.alias}{u.id === currentUserId ? ' (you)' : ''}
                </span>
                <span style={{ color: '#888', fontSize: 12 }}>{u.total_points} pts</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>Compare up to 8 players at once.</p>

      {/* Selected player chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {selected.map((uid, idx) => (
            <div
              key={uid}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px 4px 10px',
                borderRadius: 20,
                background: COLORS[idx % COLORS.length],
                color: '#fff',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span>{userById[uid]?.alias ?? uid}{uid === currentUserId ? ' (you)' : ''}</span>
              <button
                onClick={() => removeUser(uid)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  padding: '0 0 0 2px',
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chart or empty state */}
      {selected.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 32 }}>
          Add players above to see their points progression
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px 8px', fontSize: 10, color: '#bbb' }}>
            <span>Cumulative points</span>
            {matches.length * PX_PER_MATCH > 320 && <span>⇠ scroll for earlier matches</span>}
          </div>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            padding: '12px 4px 8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            <div style={{ position: 'relative' }}>
              <div
                ref={scrollRef}
                style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
                onScroll={handleScroll}
              >
                <div style={{ width: chartWidth, height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 24, right: 16, left: -16, bottom: 4 }}
                    >
              {/* ReferenceArea bands first so CartesianGrid renders on top */}
              {stageRanges.map(({ stage, start, end, orderIdx }) => (
                <ReferenceArea
                  key={stage}
                  x1={start}
                  x2={end}
                  fill={orderIdx % 2 === 0 ? '#f7f7f7' : '#ffffff'}
                  fillOpacity={1}
                  label={{
                    value: STAGE_SHORT[stage] || stage,
                    position: 'top',
                    fontSize: 9,
                    fill: orderIdx % 2 === 0 ? '#bbb' : '#0a5c45',
                    fontWeight: orderIdx % 2 === 0 ? 400 : 600,
                  }}
                />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="i"
                tick={{ fontSize: 10, fill: '#bbb' }}
                tickFormatter={v => v + 1}
              />
              <YAxis tick={{ fontSize: 10, fill: '#bbb' }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null
                  const row = chartData[label]
                  if (!row) return null
                  const sorted = [...payload].sort((a, b) => b.value - a.value)
                  return (
                    <div style={{
                      background: '#fff',
                      border: '1px solid #e8e8e8',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      minWidth: 160,
                    }}>
                      <p style={{ fontWeight: 600, color: '#333', margin: '0 0 6px' }}>
                        Match {Number(label) + 1} · {row.date} · {row.stage}
                      </p>
                      {sorted.map(p => (
                        <div key={p.dataKey} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          color: p.color,
                          marginBottom: 2,
                        }}>
                          <span>#{rankMap[p.dataKey]} {userById[p.dataKey]?.alias ?? p.dataKey}{p.dataKey === currentUserId ? ' (you)' : ''}</span>
                          <span style={{ fontWeight: 600 }}>{p.value} pts</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              {selected.map((uid, idx) => (
                <Line
                  key={uid}
                  type="monotone"
                  dataKey={uid}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {showLeftFade && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 24, width: 24,
                  background: 'linear-gradient(to right, #fff, rgba(255,255,255,0))',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
