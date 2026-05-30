'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { countries } from 'countries-list'

const extraCountries = [
  { code: 'gb-eng', name: 'England' },
  { code: 'gb-nir', name: 'Northern Ireland' },
  { code: 'gb-sct', name: 'Scotland' },
  { code: 'gb-wls', name: 'Wales' },
]

const countryList = [
  ...Object.entries(countries).map(([code, data]) => ({ code, name: data.name })),
  ...extraCountries,
].sort((a, b) => a.name.localeCompare(b.name))

export default function JoinPage() {
  const router = useRouter()
  const [mode, setMode] = useState(null) // 'new' | 'returning'
  const [alias, setAlias] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [email, setEmail] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const firstFieldRef = useRef(null)

  function switchMode(newMode) {
    setMode(newMode)
    setError('')
    setAlias('')
    setCountryCode('')
    setEmail('')
    setJoinCode('')
    setTimeout(() => firstFieldRef.current?.focus(), 0)
  }

  async function handleNewPlayer() {
    setError('')
    setLoading(true)

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

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        competition_id: competition.id,
        alias: alias.trim(),
        email: email.trim().toLowerCase(),
        country_code: countryCode || null
      })
      .select('id')
      .single()

    if (userError) {
      if (userError.code === '23505') {
        if (userError.details?.includes('alias') || userError.message?.includes('alias')) {
          setError('Sorry, this name is already taken. Please try another.')
        } else {
          setError('This email is already in use.')
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
      setLoading(false)
      return
    }

    localStorage.setItem('userId', user.id)
    localStorage.setItem('competitionId', competition.id)
    router.push('/matches')
  }

  async function handleReturningPlayer() {
    setError('')
    setLoading(true)

    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id')
      .eq('join_code', joinCode.trim().toLowerCase())
      .single()

    if (compError || !competition) {
      setError('No account found. Check if email and join code are correct.')
      setLoading(false)
      return
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('competition_id', competition.id)
      .eq('email', email.trim().toLowerCase())
      .single()

    if (userError || !user) {
      setError('No account found. Check if email and join code are correct.')
      setLoading(false)
      return
    }

    localStorage.setItem('userId', user.id)
    localStorage.setItem('competitionId', competition.id)
    router.push('/matches')
  }

  const newPlayerReady = alias.trim() && email.trim() && joinCode.trim()
  const returningPlayerReady = email.trim() && joinCode.trim()

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a5c45' }}>
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-sm">

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl">⚽</span>
          </div>
          <h1 className="text-lg font-medium text-gray-900">World Cup 2026</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome to Erik&apos;s legendary competition!</p>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              onClick={() => switchMode('new')}
              className={`w-full h-11 rounded-xl text-sm font-medium border-2 transition-all ${
                mode === 'new'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-400'
              }`}
            >
              Create account
            </button>
            <span className="text-xs text-gray-400">New player</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <button
              onClick={() => switchMode('returning')}
              className={`w-full h-11 rounded-xl text-sm font-medium border-2 transition-all ${
                mode === 'returning'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-400'
              }`}
            >
              Sign in
            </button>
            <span className="text-xs text-gray-400">Existing player</span>
          </div>
        </div>

        {mode === 'new' && (
          <>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                ref={firstFieldRef}
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Enter your name..."
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Nationality</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                style={{ color: countryCode ? '#111827' : '#9ca3af' }}
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select your country...</option>
                {countryList.map(c => (
                  <option key={c.code} value={c.code} style={{ color: '#111827' }}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Join code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter join code..."
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <button
              onClick={handleNewPlayer}
              disabled={!newPlayerReady || loading}
              className="w-full h-11 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </>
        )}

        {mode === 'returning' && (
          <>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                ref={firstFieldRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email..."
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Join code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter join code..."
                className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
              />
            </div>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <button
              onClick={handleReturningPlayer}
              disabled={!returningPlayerReady || loading}
              className="w-full h-11 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </>
        )}

        {mode && (
          <p className="text-xs text-gray-400 text-center leading-relaxed mt-4">
            The join code can be provided by your group organizer.<br />
            Your name will be visible to other players.
          </p>
        )}

      </div>
    </div>
  )
}
