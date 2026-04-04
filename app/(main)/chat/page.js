'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EMOJIS = ['👍', '😊', '😂', '😢', '😣', '🤬', '💯', '🎉', '❤️']

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
  const [reactions, setReactions] = useState([])
  const [userId, setUserId] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [competitionId, setCompetitionId] = useState(null)
  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null)
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
      const [{ data: msgData }, { data: userData }, { data: reactionData }] = await Promise.all([
        supabase.from('messages').select('*').eq('is_deleted', false).order('created_at'),
        supabase.from('users').select('id, alias'),
        supabase.from('reactions').select('*')
      ])

      setMessages(msgData || [])
      setUsers(userData || [])
      setReactions(reactionData || [])
      scrollToBottom()
    }

    fetchData()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('chat-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => {
            const exists = prev.find(m => m.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
          scrollToBottom()
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('DELETE event received:', payload)
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )      
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' },
        (payload) => {
          setReactions(prev => {
            const exists = prev.find(r => r.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload) => {
          setReactions(prev => prev.filter(r => r.id !== payload.old.id))
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('UPDATE event received:', payload)
          if (payload.new.is_deleted) {
            setMessages(prev => prev.filter(m => m.id !== payload.new.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at')
      
      if (data) setMessages(data)
    }, 10000)

    return () => clearInterval(interval)
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

    await supabase.from('messages').insert({
      competition_id: competitionId,
      user_id: userId,
      content: input.trim()
    })

    setInput('')
    scrollToBottom()
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleReaction(messageId, emoji) {
    const existing = reactions.find(
      r => r.message_id === messageId && r.user_id === userId && r.emoji === emoji
    )

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: userId,
        emoji
      })
    }
    setActiveEmojiPicker(null)
  }

  function getReactionsForMessage(messageId) {
    const msgReactions = reactions.filter(r => r.message_id === messageId)
    const grouped = {}
    for (const r of msgReactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = []
      grouped[r.emoji].push(r.user_id)
    }
    return grouped
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Sticky header */}
      <div className="sticky top-0 z-40" style={{ background: '#0a5c45' }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="text-2xl leading-none">💬</span>
          <h1 className="text-xl font-medium text-white tracking-tight">Chat</h1>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 pb-32"
        onClick={() => setActiveEmojiPicker(null)}
      >
        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const user = users.find(u => u.id === msg.user_id)
          const msgReactions = getReactionsForMessage(msg.id)
          const hasReactions = Object.keys(msgReactions).length > 0

          return (
            <div key={msg.id} className={`mb-3 ${isMe ? 'text-right' : ''}`}>
              <p className="text-xs text-gray-400 mb-1">
                {user?.alias || '—'} · {formatTime(msg.created_at)}
              </p>

              <div className={`relative inline-block ${isMe ? 'text-right' : ''}`}>
                {/* Message bubble */}

              <div
                  className={`inline-block max-w-xs px-3 py-2 rounded-xl text-sm cursor-pointer select-none
                    ${isMe
                      ? 'bg-emerald-100 text-emerald-900 rounded-tr-none'
                      : 'bg-white text-gray-900 rounded-tl-none'
                    }`}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const timer = setTimeout(() => {
                      setActiveEmojiPicker(prev => prev === msg.id ? null : msg.id)
                    }, 500)
                    e.currentTarget._pressTimer = timer
                  }}
                  onMouseUp={(e) => clearTimeout(e.currentTarget._pressTimer)}
                  onMouseLeave={(e) => clearTimeout(e.currentTarget._pressTimer)}
                  onTouchStart={(e) => {
                    e.stopPropagation()
                    const timer = setTimeout(() => {
                      setActiveEmojiPicker(prev => prev === msg.id ? null : msg.id)
                    }, 500)
                    e.currentTarget._pressTimer = timer
                  }}
                  onTouchEnd={(e) => clearTimeout(e.currentTarget._pressTimer)}
                  onTouchMove={(e) => clearTimeout(e.currentTarget._pressTimer)}
                >
                  {msg.content}
                </div>

                {/* Emoji picker */}
                {activeEmojiPicker === msg.id && (
                  <div
                    className={`absolute z-10 bg-white rounded-2xl shadow-lg border border-gray-100 p-2 flex gap-1 flex-wrap w-48 ${isMe ? 'right-0' : 'left-0'}`}
                    style={{ bottom: '100%', marginBottom: '4px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className={`text-lg p-1 rounded-lg hover:bg-gray-100 
                          ${reactions.find(r => r.message_id === msg.id && r.user_id === userId && r.emoji === emoji)
                            ? 'bg-emerald-50'
                            : ''
                          }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reaction bubbles */}
                {hasReactions && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msgReactions).map(([emoji, userIds]) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReaction(msg.id, emoji)
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1
                          ${userIds.includes(userId)
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-gray-200 text-gray-600'
                          }`}
                      >
                        {emoji} {userIds.length > 1 && <span>{userIds.length}</span>}
                      </button>
                    ))}
                  </div>
                )}
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
          className="flex-1 h-9 border border-gray-200 rounded-full px-4 text-base bg-gray-50 focus:outline-none focus:border-emerald-500"
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