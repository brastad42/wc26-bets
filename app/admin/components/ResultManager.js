'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STAGES = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final']

export default function ResultManager() {
  const [matches, setMatches] = useState([])
  const [activeStage, setActiveStage] = useState('Group')
  const [inputs, setInputs] = useState({})
  const [saving, setSaving] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMatches() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .order('match_time')

      setMatches(data || [])

      // Pre-fill inputs with existing results
      const prefilled = {}
      for (const m of data || []) {
        prefilled[m.id] = {
          home: m.result_home !== null ? String(m.result_home) : '',
          away: m.result_away !== null ? String(m.result_away) : ''
        }
      }
      setInputs(prefilled)
      setLoading(false)
    }

    loadMatches()
  }, [])

  async function handleSave(matchId) {
    const input = inputs[matchId]
    if (input.home === '' || input.away === '') return
    setSaving(matchId)

    await supabase
      .from('matches')
      .update({
        result_home: parseInt(input.home),
        result_away: parseInt(input.away)
      })
      .eq('id', matchId)

    setMatches(prev => prev.map(m =>
      m.id === matchId
        ? { ...m, result_home: parseInt(input.home), result_away: parseInt(input.away) }
        : m
    ))
    setSaving(null)
  }

  function updateInput(matchId, side, value) {
    setInputs(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value }
    }))
  }

  const filteredMatches = matches.filter(m => m.stage === activeStage)

  if (loading) return <p className="text-xs text-gray-400">Loading matches...</p>

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Set match results
      </p>

      {/* Stage tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3">
        {STAGES.map(stage => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap
              ${activeStage === stage
                ? 'bg-emerald-500 text-emerald-900 border-emerald-500'
                : 'bg-transparent text-gray-400 border-gray-200'
              }`}
          >
            {stage}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No matches for this stage.</p>
      ) : (
        filteredMatches.map(match => {
          const input = inputs[match.id] || { home: '', away: '' }
          const hasResult = match.result_home !== null && match.result_away !== null
          return (
            <div key={match.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-2">

              {/* Teams */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">
                  {match.home_team} vs {match.away_team}
                </p>
                {hasResult && (
                  <p className="text-xs text-emerald-600">
                    Result: {match.result_home} – {match.result_away}
                  </p>
                )}
              </div>

              {/* Score inputs */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={input.home}
                  onChange={(e) => updateInput(match.id, 'home', e.target.value)}
                  className="w-8 h-8 border border-gray-200 rounded-lg text-center text-sm bg-white focus:outline-none focus:border-emerald-500 text-gray-900"
                />
                <span className="text-xs text-gray-300">–</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={input.away}
                  onChange={(e) => updateInput(match.id, 'away', e.target.value)}
                  className="w-8 h-8 border border-gray-200 rounded-lg text-center text-sm bg-white focus:outline-none focus:border-emerald-500 text-gray-900"
                />
              </div>

              {/* Save button */}
              <button
                onClick={() => handleSave(match.id)}
                disabled={input.home === '' || input.away === '' || saving === match.id}
                className="text-xs px-3 py-1 bg-emerald-500 text-emerald-900 rounded-lg disabled:opacity-40 whitespace-nowrap"
              >
                {saving === match.id ? '...' : 'Save'}
              </button>

            </div>
          )
        })
      )}
    </div>
  )
}