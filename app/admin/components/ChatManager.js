'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function formatTime(utcString) {
  const date = new Date(utcString)
  return date.toLocaleString('en-GB', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short'
  })
}

export default function ChatManager() {
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [{ data: msgData }, { data: userData }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, alias')
      ])

      setMessages(msgData || [])
      setUsers(userData || [])
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleDelete(messageId) {
    await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    setMessages(prev => prev.filter(m => m.id !== messageId))
  }

  if (loading) return <p className="text-xs text-gray-400">Loading messages...</p>

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Chat messages
      </p>

      {messages.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
      ) : (
        messages.map(msg => {
          const user = users.find(u => u.id === msg.user_id)
          return (
            <div key={msg.id} className="flex justify-between items-start bg-gray-50 rounded-lg px-3 py-2 mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">
                  {user?.alias || '—'} · {formatTime(msg.created_at)}
                </p>
                <p className="text-sm text-gray-700 truncate">{msg.content}</p>
              </div>
              <button
                onClick={() => handleDelete(msg.id)}
                className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-500 flex-shrink-0"
              >
                Delete
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}