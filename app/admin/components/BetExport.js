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

function toOsloTime(utcString) {
  if (!utcString) return ''
  const date = new Date(utcString)
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function BetExport() {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)

    const [
      { data: competitions },
      { data: matches },
      { data: users },
      { data: bets }
    ] = await Promise.all([
      supabase.from('competitions').select('*'),
      supabase.from('matches').select('*').order('match_time'),
      supabase.from('users').select('*').eq('is_active', true),
      supabase.from('bets').select('*')
    ])

    const competition = competitions?.[0]
    const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))

    const rows = []

    for (const match of matches) {
      for (const user of users) {
        const bet = bets.find(b => b.match_id === match.id && b.user_id === user.id)
        const pts = bet ? calcPoints(match, bet.bet_home, bet.bet_away) : null
        const exact = pts === 3 ? 1 : 0
        const dns = bet ? 0 : 1

        rows.push([
          competition?.name || '',
          match.id,
          match.stage,
          toOsloTime(match.match_time),
          match.home_team,
          match.away_team,
          user.alias,
          bet ? bet.bet_home : 'DNS',
          bet ? bet.bet_away : 'DNS',
          bet ? toOsloTime(bet.created_at) : '',
          dns ? 0 : (pts ?? ''),
          dns ? 0 : exact
        ])
      }
    }

    // Build CSV string
    const headers = [
      'competition', 'match_id', 'stage', 'kickoff_at',
      'home_team', 'away_team', 'alias',
      'bet_home', 'bet_away', 'submitted_at',
      'points', 'exact_hit'
    ]

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download the file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wc26-bets-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Export bets
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Downloads a CSV with one row per bet per user per match.
      </p>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full h-9 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm disabled:opacity-50"
      >
        {exporting ? 'Exporting...' : 'Download CSV ↓'}
      </button>
    </div>
  )
}