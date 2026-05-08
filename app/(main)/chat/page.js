'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LogoutButton from '@/app/components/LogoutButton'

const EMOJIS = ['👍', '😊', '😂', '😢', '😣', '🤬', '💯', '🎉', '❤️', '👏', '💪','🙌']
const PAGE_SIZE = 50
const SCROLL_BTN_THRESHOLD = 200

function formatTime(utcString) {
  const date = new Date(utcString)
  return date.toLocaleString('en-GB', {
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
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  // Refs used inside callbacks to avoid stale closures
  const hasMoreRef = useRef(true)
  const loadingOlderRef = useRef(false)
  const oldestCreatedAtRef = useRef(null)
  // Saved scroll height before prepending older messages
  const prevScrollHeightRef = useRef(null)

  // After older messages are prepended, restore scroll position before browser paints
  useLayoutEffect(() => {
    if (prevScrollHeightRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeightRef.current
      prevScrollHeightRef.current = null
    }
  }, [messages])

  useEffect(() => {
    setUserId(localStorage.getItem('userId'))
    setCompetitionId(localStorage.getItem('competitionId'))
  }, [])

  function scrollToBottom(instant = false) {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' })
    }, 50)
  }

  useEffect(() => {
    async function fetchInitial() {
      const [{ data: msgData }, { data: userData }, { data: reactionData }] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
        supabase.from('users').select('id, alias'),
        supabase.from('reactions').select('*')
      ])

      const msgs = (msgData || []).reverse()
      setMessages(msgs)
      setUsers(userData || [])
      setReactions(reactionData || [])

      if (msgs.length > 0) oldestCreatedAtRef.current = msgs[0].created_at
      if (msgs.length < PAGE_SIZE) {
        hasMoreRef.current = false
        setHasMore(false)
      }

      scrollToBottom(true)
    }

    fetchInitial()
  }, [])

  async function loadOlderMessages() {
    if (loadingOlderRef.current || !hasMoreRef.current || !oldestCreatedAtRef.current) return

    loadingOlderRef.current = true
    setLoadingOlder(true)

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('is_deleted', false)
      .lt('created_at', oldestCreatedAtRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (!data || data.length === 0) {
      hasMoreRef.current = false
      setHasMore(false)
      loadingOlderRef.current = false
      setLoadingOlder(false)
      return
    }

    const older = data.reverse()
    oldestCreatedAtRef.current = older[0].created_at

    // Save height before prepend so useLayoutEffect can restore position
    if (scrollRef.current) prevScrollHeightRef.current = scrollRef.current.scrollHeight

    setMessages(prev => [...older, ...prev])
    if (data.length < PAGE_SIZE) {
      hasMoreRef.current = false
      setHasMore(false)
    }

    loadingOlderRef.current = false
    setLoadingOlder(false)
  }

  useEffect(() => {
    const channel = supabase
      .channel('chat-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.is_deleted) return
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          // Only auto-scroll if user is already near the bottom
          const el = scrollRef.current
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BTN_THRESHOLD) {
            scrollToBottom()
          }
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.is_deleted) {
            setMessages(prev => prev.filter(m => m.id !== payload.new.id))
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' },
        (payload) => {
          setReactions(prev => {
            if (prev.find(r => r.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload) => {
          setReactions(prev => prev.filter(r => r.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distanceFromBottom > SCROLL_BTN_THRESHOLD)
    if (el.scrollTop < 50) loadOlderMessages()
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
      await supabase.from('reactions').insert({ message_id: messageId, user_id: userId, emoji })
    }
    setActiveEmojiPicker(null)
  }

  function getReactionsForMessage(messageId) {
    const grouped = {}
    for (const r of reactions.filter(r => r.message_id === messageId)) {
      if (!grouped[r.emoji]) grouped[r.emoji] = []
      grouped[r.emoji].push(r.user_id)
    }
    return grouped
  }

  return (
    <div className="h-dvh overflow-hidden bg-gray-100 flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">💬</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Chat</h1>
          </div>
          <LogoutButton />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 pb-32"
        onClick={() => setActiveEmojiPicker(null)}
      >
        {loadingOlder && (
          <p className="text-xs text-gray-400 text-center py-2">Loading older messages...</p>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="text-xs text-gray-300 text-center py-2">Beginning of chat</p>
        )}

        {messages.map(msg => {
          const isMe = msg.user_id === userId
          const user = users.find(u => u.id === msg.user_id)
          const msgReactions = getReactionsForMessage(msg.id)
          const hasReactions = Object.keys(msgReactions).length > 0

          return (
            <div key={msg.id} className={`mb-3 group ${isMe ? 'text-right' : ''}`}>
              <p className="text-xs text-gray-400 mb-1">
                {user?.alias || '—'} · {formatTime(msg.created_at)}
              </p>

              <div className={`relative inline-block ${isMe ? 'text-right' : ''}`}>
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

                {/* Hover reaction trigger — desktop only, hidden on touch devices */}
                <button
                  className={`absolute top-1 z-10 w-6 h-6 flex items-center justify-center text-base
                    opacity-0 pointer-events-none transition-opacity
                    [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:pointer-events-auto
                    ${isMe ? 'right-full mr-1' : 'left-full ml-1'}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveEmojiPicker(prev => prev === msg.id ? null : msg.id)
                  }}
                >
                  😊
                </button>

                {/* Emoji picker */}
                {activeEmojiPicker === msg.id && (
                  <div
                    className={`absolute z-10 bg-white rounded-2xl shadow-lg border border-gray-100 p-2 flex gap-1 flex-wrap w-48 ${isMe ? 'right-0' : 'left-0'}`}
                    style={{ bottom: '100%', marginBottom: '4px' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onMouseDown={(e) => e.stopPropagation()}
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
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'instant' })}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border border-gray-200 rounded-full text-gray-400 text-sm shadow-sm"
        >
          ↓
        </button>
      )}

      {/* Input bar */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 px-3 py-2 flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 h-9 border border-gray-200 rounded-full px-4 text-base bg-gray-50 focus:outline-none focus:border-emerald-500 text-gray-900 placeholder-gray-400"
          style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
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
