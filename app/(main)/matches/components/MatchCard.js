'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

const FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia-Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'Congo': 'cg', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
}

function getFlag(teamName) {
  const code = FLAGS[teamName]
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}

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
  const [saveError, setSaveError] = useState(null)
  const [showAllBets, setShowAllBets] = useState(false)

  async function handleSaveBet() {
    if (homeInput === '' || awayInput === '') return
    setSaving(true)
    setSaveError(null)

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

    if (error) {
      console.error('Bet save failed:', error)
      setSaveError(error.message || 'Failed to save bet — please try again.')
    } else {
      onBetSaved(data)
    }
    setSaving(false)
  }

  const myPoints = myBet ? calcPoints(match, myBet.bet_home, myBet.bet_away) : null

  return (
    <div className="bg-white rounded-xl p-3 mb-2" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

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
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {getFlag(match.home_team) && (
            <Image src={getFlag(match.home_team)} alt={match.home_team} width={24} height={16} className="flex-shrink-0 rounded-sm" style={{ width: '24px', height: 'auto' }} />
          )}
          <span className="text-sm font-medium text-gray-900 truncate">{match.home_team}</span>
        </div>

        {status === 'open' ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <input
              type="number"
              min="0"
              max="99"
              value={homeInput}
              onChange={(e) => setHomeInput(e.target.value)}
              className="w-8 h-8 border border-gray-200 rounded-lg text-center text-base font-medium bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900"
            />
            <span className="text-xs text-gray-300">–</span>
            <input
              type="number"
              min="0"
              max="99"
              value={awayInput}
              onChange={(e) => setAwayInput(e.target.value)}
              className="w-8 h-8 border border-gray-200 rounded-lg text-center text-base font-medium bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900"
            />
          </div>
        ) : (
          <div className="text-center flex-shrink-0">
            {match.result_home !== null && match.result_away !== null ? (
              <span className="text-lg font-medium text-gray-900">
                {match.result_home} – {match.result_away}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Upcoming</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate text-right">{match.away_team}</span>
          {getFlag(match.away_team) && (
            <Image src={getFlag(match.away_team)} alt={match.away_team} width={24} height={16} className="flex-shrink-0 rounded-sm" style={{ width: '24px', height: 'auto' }} />
          )}
        </div>
      </div>

      {/* Open stage: save bet button */}
      {status === 'open' && (
        <>
          <button
            onClick={handleSaveBet}
            disabled={homeInput === '' || awayInput === '' || saving}
            className={`w-full h-8 rounded-lg text-xs font-medium border disabled:opacity-50
              ${myBet ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-50 border-emerald-300 text-emerald-700'}`}
          >
            {saving ? 'Saving...' : myBet ? 'Update bet' : 'Place bet'}
          </button>
          {saveError && (
            <p className="text-xs text-red-500 text-center mt-1">{saveError}</p>
          )}
          {!saveError && <p className="text-xs text-gray-400 text-center mt-1">Bets are hidden until stage kicks off</p>}
        </>
      )}

      {/* Locked stage: show my bet and points */}
      {status === 'locked' && myBet && (
        <div className="grid grid-cols-3 text-xs bg-amber-50 rounded-lg px-3 py-2 mt-1 gap-2">
          <span className="text-gray-600 text-left truncate">
            {users.find(u => u.id === userId)?.alias || 'You'}
          </span>
          <span className="font-medium text-gray-900 text-center">
            {myBet.bet_home} – {myBet.bet_away}
          </span>
          {myPoints !== null && (
            <span className={`font-medium text-right
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
          {showAllBets ? 'Hide bets ▴' : 'View all players bets ▾'}
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
              if (ptsB !== ptsA) return ptsB - ptsA
              return a.user.alias.localeCompare(b.user.alias)
            })
            .map(({ user, bet, pts }) => (
              
              <div key={user.id} 
              className="grid grid-cols-3 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 gap-2">
                <span className="truncate">{user.alias}</span>
                <span className="font-medium text-center">
                  {bet ? `${bet.bet_home} – ${bet.bet_away}` : 'DNS'}
                </span>
                <span className={`font-medium text-right
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