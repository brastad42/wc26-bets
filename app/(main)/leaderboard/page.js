'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STAGES = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final']

function calcPoints(match, betHome, betAway) {
  if (match.result_home === null || match.result_away === null) return 0
  if (betHome === match.result_home && betAway === match.result_away) return 3
  const resultWinner = Math.sign(match.result_home - match.result_away)
  const betWinner = Math.sign(betHome - betAway)
  if (resultWinner === betWinner) return 1
  return 0
}

function isExact(match, betHome, betAway) {
  if (match.result_home === null || match.result_away === null) return false
  return betHome === match.result_home && betAway === match.result_away
}

function buildLeaderboard(users, bets, matches) {
  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))

  return users
    .filter(u => u.is_active)
    .map(user => {
      const userBets = bets.filter(b => b.user_id === user.id)
      let totalPoints = 0
      let totalExact = 0
      const exactByStage = Object.fromEntries(STAGES.map(s => [s, 0]))

      for (const bet of userBets) {
        const match = matchMap[bet.match_id]
        if (!match) continue
        const pts = calcPoints(match, bet.bet_home, bet.bet_away)
        const exact = isExact(match, bet.bet_home, bet.bet_away)
        totalPoints += pts
        if (exact) {
          totalExact++
          exactByStage[match.stage]++
        }
      }

      return { ...user, totalPoints, totalExact, exactByStage }
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.totalExact !== a.totalExact) return b.totalExact - a.totalExact
      for (const stage of STAGES) {
        if (b.exactByStage[stage] !== a.exactByStage[stage]) {
          return b.exactByStage[stage] - a.exactByStage[stage]
        }
      }
      return 0
    })
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const id = localStorage.getItem('userId')
      setUserId(id)
    }
    init()
  }, [])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const [{ data: users }, { data: bets }, { data: matches }] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('bets').select('*'),
        supabase.from('matches').select('*')
      ])

      setLeaderboard(buildLeaderboard(users || [], bets || [], matches || []))
      setLoading(false)
    }

    fetchData()
  }, [])

  async function handleRefresh() {
    setLoading(true)

    const [{ data: users }, { data: bets }, { data: matches }] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('bets').select('*'),
      supabase.from('matches').select('*')
    ])

    setLeaderboard(buildLeaderboard(users || [], bets || [], matches || []))
    setLoading(false)
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f4f5f7' }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-40" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">🏆</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Leaderboard</h1>
          </div>
          <button
            onClick={handleRefresh}
            className="text-xs px-3 py-1 rounded-full"
            style={{ color: 'rgba(255,255,255,0.75)', border: '0.5px solid rgba(255,255,255,0.3)' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-3 pt-3">
        {loading ? (
          <p className="text-sm text-gray-400 text-center mt-8">Loading...</p>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">

            {/* Header */}
            <div className="grid grid-cols-[28px_1fr_52px_52px] gap-1 px-4 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-400 font-medium">#</span>
              <span className="text-xs text-gray-400 font-medium">Player</span>
              <span className="text-xs text-gray-400 font-medium text-center">Points</span>
              <span className="text-xs text-gray-400 font-medium text-center">Exact</span>
            </div>

            {/* Rows */}
            {leaderboard.map((user, index) => {
              const isMe = user.id === userId
              const rank = index + 1
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
              return (
                <div
                  key={user.id}
                  className={`grid grid-cols-[28px_1fr_52px_52px] gap-1 px-4 py-3 border-b border-gray-50 items-center
                    ${isMe ? 'bg-emerald-50' : ''}`}
                >
                  <span className={`text-sm font-medium ${isMe ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {medal ?? rank}
                  </span>
                  <span className={`text-sm ${isMe ? 'text-emerald-700 font-medium' : 'text-gray-900'}`}>
                    {user.alias}{isMe ? ' (you)' : ''}
                  </span>
                  <span className={`text-sm font-medium text-center ${isMe ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {user.totalPoints}
                  </span>
                  <span className={`text-sm text-center ${isMe ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {user.totalExact}
                  </span>
                </div>
              )
            })}

            {/* Tiebreaker note */}
            <p className="text-xs text-gray-400 text-center py-3">
              Tie-breaker: Exact hits by stage (Group → Final)
            </p>

          </div>
        )}
      </div>

    </div>
  )
}