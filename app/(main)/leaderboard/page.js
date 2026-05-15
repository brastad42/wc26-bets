'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LogoutButton from '@/app/components/LogoutButton'

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setUserId(localStorage.getItem('userId'))
  }, [])

  async function fetchLeaderboard() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.rpc('get_leaderboard')
    if (fetchError) {
      setError('Could not load leaderboard — please refresh the page.')
      setLoading(false)
      return
    }
    setLeaderboard(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#f4f5f7' }}>

      {/* Header */}
      <div className="flex-shrink-0" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">🏆</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Leaderboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeaderboard}
              className="text-xs px-3 py-1 rounded-full"
              style={{ color: 'rgba(255,255,255,0.75)', border: '0.5px solid rgba(255,255,255,0.3)' }}
            >
              ↻ Refresh
            </button>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-3 pt-3" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        {loading ? (
          <p className="text-sm text-gray-400 text-center mt-8">Loading...</p>
        ) : error ? (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
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
            {(() => {
              const sorted = [...leaderboard].sort((a, b) => {
                if (b.total_points !== a.total_points) return b.total_points - a.total_points
                if (b.total_exact !== a.total_exact) return b.total_exact - a.total_exact
                return a.alias.localeCompare(b.alias)
              })
              let currentRank = 1
              return sorted.map((user, index) => {
                if (index > 0) {
                  const prev = sorted[index - 1]
                  if (user.total_points !== prev.total_points || user.total_exact !== prev.total_exact) {
                    currentRank = index + 1
                  }
                }
                const rank = currentRank
                const isMe = user.id === userId
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
                      {user.total_points}
                    </span>
                    <span className={`text-sm text-center ${isMe ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {user.total_exact}
                    </span>
                  </div>
                )
              })
            })()}

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
