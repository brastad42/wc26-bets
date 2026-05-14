'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const DEFAULT_SECTIONS = [
  {
    title: '📢 Gamemaster Notice Board',
    body: 'Important decrees from your all-powerful Gamemaster will appear here.'
  },
  {
    title: 'Joining',
    body: 'New user: Create an account by entering your chosen name, your email address, and the join code shared by the organizer. Your name will be visible to all other players.\nExisting user: Log in from any device or browser by entering your email address and the join code. You will be recognized automatically and can continue where you left off.'
  },
  {
    title: 'Placing bets',
    body: 'Submit your score prediction for every match before the first kickoff in each stage. You can update your bet any time before that deadline. After kickoff, bets are locked for the whole stage.'
  },
  {
    title: 'Deadlines for placing bets',
    body: 'Group: June 11 at 21:00 (Oslo time)\nR32: June 28 at 21:00\nR16: July 4 at 19:00\nQF: July 9 at 22:00\nSF: July 14 at 21:00\nFinal: July 18 at 23:00'
  },
  {
    title: 'DNS — did not submit',
    body: 'If you miss the deadline for a stage, you get 0 points (DNS) for all matches in that stage. You can still place bets for the next stage when it opens.'
  },
  {
    title: 'Scoring',
    body: 'Points are based on the result after 90 minutes + stoppage time only. Extra time and penalties in knock-out stages do not count. For example: A draw after 90 min (+ stoppage time) counts as a draw, regardless of what happens after.'
  },
  {
    title: 'Leaderboard & tie-breakers',
    body: 'Sorted by: 1. Total points · 2. Total exact hits · 3. Exact hits by stage in order: Group → R32 → R16 → QF → SF → Final'
  },
  {
    title: 'Credits',
    body: 'Gamemaster: Erik Olsson Standal — mastermind behind the competition and all executive decisions. All complaints go here.\n\nDeveloper: Thomas Rasch Brastad — designed and built this app, powered by coffee and AI.'
  }
]

export default function RulesManager() {
  const [sections, setSections] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'rules')
        .single()

      setSections(data?.value ?? DEFAULT_SECTIONS)
    }
    load()
  }, [])

  function updateSection(index, field, value) {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'rules', value: sections }, { onConflict: 'key' })

    setSaving(false)
    setStatus(error ? 'Error saving. Try again.' : 'Saved!')
    if (!error) setTimeout(() => setStatus(null), 3000)
  }

  if (!sections) return <p className="text-xs text-gray-400">Loading rules...</p>

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
          <input
            type="text"
            value={section.title}
            onChange={e => updateSection(i, 'title', e.target.value)}
            className="w-full text-xs font-medium text-emerald-700 uppercase tracking-wide bg-transparent border-b border-gray-200 pb-1 focus:outline-none focus:border-emerald-400"
          />
          <textarea
            value={section.body}
            onChange={e => updateSection(i, 'body', e.target.value)}
            rows={4}
            className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-9 px-4 bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save rules'}
        </button>
        {status && (
          <p className={`text-xs ${status.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
