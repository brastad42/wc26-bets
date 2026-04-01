'use client'

import { useEffect, useRef, useState } from 'react'
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

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [competitionId, setCompetitionId] = useState(null)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    async function init() {
      const id = localStorage.getItem('userId')
      const compId = localStorage.getItem('competitionId')
      setUserId(id)
      setCompetitionId(compId)
    }
    init()
  }, [])

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    async function fetchData() {
      const [{ data: msgData }, { data: userData }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .order('created_at'),
        supabase
          .from('users')
          .select('id, alias')
      ])

      setMessages(msgData || [])
      setUsers(userData || [])
      scrollToBottom()
    }

    fetchData()
  }, [])

useEffect(() => {
    const channel = supabase
      .channel('chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => {
            const exists = prev.find(m => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
          scrollToBottom()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distanceFromBottom > 100)
  }

  async function handleSend() {
    if (!input.trim() || !userId || !competitionId) return
    setSending(true)

    const { data, error } = await supabase
      .from('messages')
      .insert({
        competition_id: competitionId,
        user_id: userId,
        content: input.trim()
      })

    if (!error) {
      setInput('')
      scrollToBottom()
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Top bar */}
      <div className="bg-white px-4 pt-12 pb-3">
        <h1 className="text-lg font-medium text-gray-900">Chat</h1>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 pb-32"
      >
        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const user = users.find(u => u.id === msg.user_id)
          return (
            <div key={msg.id} className={`mb-3 ${isMe ? 'text-right' : ''}`}>
              <p className="text-xs text-gray-400 mb-1">
                {user?.alias || '—'} · {formatTime(msg.created_at)}
              </p>
              <div className={`inline-block max-w-xs px-3 py-2 rounded-xl text-sm
                ${isMe
                  ? 'bg-emerald-100 text-emerald-900 rounded-tr-none'
                  : 'bg-white text-gray-900 rounded-tl-none'
                }`}>
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-4 w-8 h-8 bg-white border border-gray-200 rounded-full text-gray-400 text-sm shadow-sm"
        >
          ↓
        </button>
      )}

      {/* Input bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 h-9 border border-gray-200 rounded-full px-4 text-sm bg-gray-50 focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7L13 1L8 13L7 8L1 7Z" fill="white"/>
          </svg>
        </button>
      </div>

    </div>
  )
}