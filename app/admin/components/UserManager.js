'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)
  const [newAlias, setNewAlias] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('alias')

      setUsers(data || [])
      setLoading(false)
    }

    loadUsers()
  }, [])

  async function handleRename(userId) {
    if (!newAlias.trim()) return

    const { data } = await supabase
      .from('users')
      .update({ alias: newAlias.trim() })
      .eq('id', userId)
      .select()
      .single()

    setUsers(prev => prev.map(u => u.id === data.id ? data : u))
    setEditing(null)
    setNewAlias('')
  }

  async function handleDeactivate(userId) {
    const { data } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single()

    setUsers(prev => prev.map(u => u.id === data.id ? data : u))
  }

  async function handleReactivate(userId) {
    const { data } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', userId)
      .select()
      .single()

    setUsers(prev => prev.map(u => u.id === data.id ? data : u))
  }

  if (loading) return <p className="text-xs text-gray-400">Loading users...</p>

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      
      {users.map(user => (
        <div key={user.id} className={`bg-gray-50 rounded-lg px-3 py-2 mb-2 ${!user.is_active ? 'opacity-50' : ''}`}>

          {editing === user.id ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(user.id)}
                placeholder={user.alias}
                className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm bg-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => handleRename(user.id)}
                className="text-xs px-3 py-1 bg-emerald-500 text-emerald-900 rounded-lg"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(null); setNewAlias('') }}
                className="text-xs px-3 py-1 bg-gray-200 text-gray-600 rounded-lg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-900">{user.alias}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(user.id); setNewAlias(user.alias) }}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500"
                >
                  Rename
                </button>
                {user.is_active ? (
                  <button
                    onClick={() => handleDeactivate(user.id)}
                    className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-500"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(user.id)}
                    className="text-xs px-2 py-1 border border-emerald-200 rounded-lg text-emerald-600"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      ))}
    </div>
  )
}