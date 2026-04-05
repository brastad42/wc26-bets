'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STAGES = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final']

export default function StageManager() {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [competitionId, setCompetitionId] = useState(null)

  useEffect(() => {
    async function loadStages() {
      const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .single()

      setCompetitionId(comp.id)

      const { data } = await supabase
        .from('stages')
        .select('*')
        .eq('competition_id', comp.id)

      setStages(data || [])
      setLoading(false)
    }

    loadStages()
  }, [])

  async function toggleStage(stageName) {
    const existing = stages.find(s => s.stage === stageName)

    if (existing) {
      const newIsOpen = !existing.is_open
      const { data } = await supabase
        .from('stages')
        .update({
          is_open: newIsOpen,
          locked_at: newIsOpen ? null : new Date().toISOString(),
          opened_at: newIsOpen ? new Date().toISOString() : existing.opened_at
        })
        .eq('id', existing.id)
        .select()
        .single()

      setStages(prev => prev.map(s => s.id === data.id ? data : s))
    } else {
      const { data } = await supabase
        .from('stages')
        .insert({
          competition_id: competitionId,
          stage: stageName,
          is_open: false,
          locked_at: new Date().toISOString()
        })
        .select()
        .single()

      setStages(prev => [...prev, data])
    }
  }

  function getStatus(stageName) {
    const stage = stages.find(s => s.stage === stageName)
    if (!stage) return 'open'
    return stage.is_open ? 'open' : 'locked'
  }

  if (loading) return <p className="text-xs text-gray-400">Loading stages...</p>

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      
      {STAGES.map(stageName => {
        const status = getStatus(stageName)
        return (
          <div key={stageName} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 mb-2">
            <span className="text-sm text-gray-900">{stageName}</span>
            <button
              onClick={() => toggleStage(stageName)}
              className={`text-xs px-3 py-1 rounded-full
                ${status === 'open'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
            >
              {status === 'open' ? 'Open ●' : 'Locked'}
            </button>
          </div>
        )
      })}
    </div>
  )
}