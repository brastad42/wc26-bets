'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const router = useRouter()
  const [alias, setAlias] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setError('')
    setLoading(true)

    // 1. Finn konkurransen med riktig join-kode
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('join_code', joinCode.trim().toLowerCase())
      .single()

    if (compError || !competition) {
      setError('The computer says no. Please try again.')
      setLoading(false)
      return
    }

    // 2. Opprett bruker i databasen
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        competition_id: competition.id,
        alias: alias.trim()
      })
      .select()
      .single()

    if (userError) {
      setError('Oops, something went tits-up. Please try again.')
      setLoading(false)
      return
    }

    // 3. Lagre bruker-ID lokalt i nettleseren
    localStorage.setItem('userId', user.id)
    localStorage.setItem('competitionId', competition.id)

    // 4. Send brukeren videre til kampvisningen
    router.push('/matches')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-sm">

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl">⚽</span>
          </div>
          <h1 className="text-lg font-medium text-gray-900">World Cup 2026</h1>
          <p className="text-sm text-gray-400 mt-1">The legendary betting competition</p>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Name / alias</label>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Enter your name or alias..."
            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Join code</label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter join code..."
            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-sm bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={!alias.trim() || !joinCode.trim() || loading}
          className="w-full h-11 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Join the competition'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
          The join code can be provided by your group organizer.<br />
          Your name will be visible to other players.
        </p>

      </div>
    </div>
  )
}