'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function calcPoints(match, betHome, betAway) {
  if (match.result_home === null || match.result_away === null) return null
  if (betHome === match.result_home && betAway === match.result_away) return 3
  const resultWinner = Math.sign(match.result_home - match.result_away)
  const betWinner = Math.sign(betHome - betAway)
  if (resultWinner === betWinner) return 1
  return 0
}

export default function MatchCard({ match, status, userId, bets, users, formatTime, onBetSaved }) {
  const myBet = bets.find(b => b.user_id === userId)
  const [homeInput, setHomeInput] = useState(myBet ? String(myBet.bet_home) : '')
  const [awayInput, setAwayInput] = useState(myBet ? String(myBet.bet_away) : '')
  const [saving, setSaving] = useState(false)
  const [showAllBets, setShowAllBets] = useState(false)

  async function handleSaveBet() {
    if (homeInput === '' || awayInput === '') return
    setSaving(true)

    const betData = {
      user_id: userId,
      match_id: match.id,
      bet_home: parseInt(homeInput),
      bet_away: parseInt(awayInput)
    }

    const { data, error } = await supabase
      .from('bets')
      .upsert(betData, { onConflict: 'user_id,match_id' })
      .select()
      .single()

    if (!error) onBetSaved(data)
    setSaving(false)
  }

  const myPoints = myBet ? calcPoints(match, myBet.bet_home, myBet.bet_away) : null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2">

      {/* Meta row */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-400">{formatTime(match.match_time)}</span>
        {status === 'open' && (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Open</span>
        )}
        {status === 'locked' && (
          <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">Locked</span>
        )}
      </div>

      {/* Teams row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-sm font-medium text-gray-900 flex-1">{match.home_team}</span>

        {status === 'open' ? (
          // Bet inputs
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="99"
              value={homeInput}
              onChange={(e) => setHomeInput(e.target.value)}
              className="w-8 h-8 border border-gray-200 rounded-lg text-center text-sm font-medium bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900"
            />
            <span className="text-xs text-gray-300">–</span>
            <input
              type="number"
              min="0"
              max="99"
              value={awayInput}
              onChange={(e) => setAwayInput(e.target.value)}
              className="w-8 h-8 border border-gray-200 rounded-lg text-center text-sm font-medium bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900"
            />
          </div>
        ) : (
          // Final result
          <div className="text-center">
            {match.result_home !== null && match.result_away !== null ? (
              <span className="text-lg font-medium text-gray-900">
                {match.result_home} – {match.result_away}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Upcoming</span>
            )}
          </div>
        )}

        <span className="text-sm font-medium text-gray-900 flex-1 text-right">{match.away_team}</span>
      </div>

      {/* Open stage: save bet button */}
      {status === 'open' && (
        <>
          <button
            onClick={handleSaveBet}
            disabled={homeInput === '' || awayInput === '' || saving}
            className={`w-full h-8 rounded-lg text-xs font-medium border disabled:opacity-40
              ${myBet ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-transparent border-emerald-400 text-emerald-700'}`}
          >
            {saving ? 'Saving...' : myBet ? 'Update bet' : 'Place bet'}
          </button>
          <p className="text-xs text-gray-300 text-center mt-1">Bets are hidden until stage kicks off</p>
        </>
      )}

      {/* Locked stage: show my bet and points */}
      {status === 'locked' && myBet && (
        <div className="flex justify-between items-center text-xs bg-amber-50 rounded-lg px-3 py-2 mt-1">
            <span className="text-gray-600">
            {users.find(u => u.id === userId)?.alias || 'You'}
            </span>
            <span className="font-medium text-gray-900">
            {myBet.bet_home} – {myBet.bet_away}
            </span>
            {myPoints !== null && (
            <span className={`font-medium
                ${myPoints === 3 ? 'text-emerald-600' :
                myPoints === 1 ? 'text-amber-600' :
                'text-gray-400'}`}>
                {myPoints} pts
            </span>
            )}
        </div>
        )}

      {/* Locked stage: view all bets */}
      {status === 'locked' && (
        <button
          onClick={() => setShowAllBets(prev => !prev)}
          className="w-full h-7 mt-2 border border-gray-200 rounded-lg text-xs text-gray-400 bg-transparent"
        >
          {showAllBets ? 'Hide bets ▴' : 'View all bets ▾'}
        </button>
      )}

      {showAllBets && (
        <div className="mt-2 space-y-1">
          {users
            .map(user => {
              const bet = bets.find(b => b.user_id === user.id)
              const pts = bet ? calcPoints(match, bet.bet_home, bet.bet_away) : null
              return { user, bet, pts }
            })
            .sort((a, b) => {
              const ptsA = a.pts ?? -1
              const ptsB = b.pts ?? -1
              return ptsB - ptsA
            })
            .map(({ user, bet, pts }) => (
              <div key={user.id} className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                <span>{user.alias}</span>
                <span className="font-medium">
                  {bet ? `${bet.bet_home} – ${bet.bet_away}` : 'DNS'}
                </span>
                <span className={`font-medium
                  ${pts === 3 ? 'text-emerald-600' :
                    pts === 1 ? 'text-amber-600' :
                    'text-gray-400'}`}>
                  {pts !== null ? `${pts} pts` : '0 pts'}
                </span>
              </div>
            ))
          }
        </div>
      )}

    </div>
  )
}