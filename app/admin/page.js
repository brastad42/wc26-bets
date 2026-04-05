'use client'

import { useState } from 'react'
import CsvImport from './components/CsvImport'
import StageManager from './components/StageManager'
import ResultManager from './components/ResultManager'
import UserManager from './components/UserManager'
import ChatManager from './components/ChatManager'
import BetExport from './components/BetExport'
import AdminSection from './components/AdminSection'

const ADMIN_CODE = 'admin2026'

export default function AdminPage() {
  const [code, setCode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  function handleLogin() {
    if (code === ADMIN_CODE) {
      setAuthed(true)
    } else {
      setError('Wrong code. Try again.')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-base font-medium text-gray-900">Admin access</h1>
            <p className="text-xs text-gray-400 mt-1">Enter the admin code to continue</p>
          </div>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Admin code..."
            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 mb-3 text-gray-900 placeholder-gray-400"
          />
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full h-10 bg-emerald-500 text-emerald-900 font-medium rounded-lg text-sm"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-40" style={{ background: '#0a5c45' }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-4">
          <span className="text-2xl leading-none">⚙️</span>
          <h1 className="text-xl font-medium text-white tracking-tight">Admin</h1>
        </div>
      </div>
      <div className="max-w-sm mx-auto p-4">
        <AdminSection title="Stages — open / lock bets" defaultOpen={true}>
          <StageManager />
        </AdminSection>
        <AdminSection title="Set match results">
          <ResultManager />
        </AdminSection>
        <AdminSection title="Import matches (CSV)">
          <CsvImport />
        </AdminSection>
        <AdminSection title="Export bets">
          <BetExport />
        </AdminSection>
        <AdminSection title="Users">
          <UserManager />
        </AdminSection>
        <AdminSection title="Chat messages">
          <ChatManager />
        </AdminSection>
      </div>
    </div>
  )
}