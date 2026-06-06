'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MatchCard from './components/MatchCard'
import LogoutButton from '@/app/components/LogoutButton'

const STAGES = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final']

const FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czechia': 'cz',
  'Canada': 'ca', 'Bosnia-Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
}

function formatTime(utcString) {
  const date = new Date(utcString)
  const weekday = date.toLocaleString('en-GB', { weekday: 'short' })
  const rest = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${weekday} ${rest}`
}

export default function MatchesPage() {
  const [activeStage, setActiveStage] = useState('Group')
  const [matches, setMatches] = useState([])
  const [stageStatus, setStageStatus] = useState({})
  const [bets, setBets] = useState([])
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const stageCache = useRef({})
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = sessionStorage.getItem('collapsedGroups')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  function toggleGroup(group) {
    setCollapsedGroups(prev => {
      const updated = { ...prev, [group]: !isCollapsed(group) }
      sessionStorage.setItem('collapsedGroups', JSON.stringify(updated))
      return updated
    })
  }

  function isCollapsed(group) {
    if (activeStage !== 'Group') return false
    return collapsedGroups[group] === undefined ? true : collapsedGroups[group]
  }

  function getGroupTeams(group) {
    const groupMatches = matches.filter(m => m.match_group === group)
    const teams = new Set()
    for (const m of groupMatches) {
      teams.add(m.home_team)
      teams.add(m.away_team)
    }
    return [...teams].slice(0, 4)
  }

  async function fetchStage(stage, currentUserId) {
    if (stageCache.current[stage]) {
      setMatches(stageCache.current[stage].matches)
      setBets(stageCache.current[stage].bets)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('stage', stage)
      .order('match_time')

    if (matchError) {
      setError('Could not load matches — please refresh the page.')
      setLoading(false)
      return
    }

    const matchIds = (matchData || []).map(m => m.id)
    const { data: betData } = matchIds.length > 0 && currentUserId
      ? await supabase.from('bets').select('id, match_id, user_id, bet_home, bet_away').in('match_id', matchIds).eq('user_id', currentUserId)
      : { data: [] }

    stageCache.current[stage] = { matches: matchData || [], bets: betData || [] }
    setMatches(matchData || [])
    setBets(betData || [])
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const uid = localStorage.getItem('userId')
      setUserId(uid)

      const [{ data: stageData }, { data: userData }] = await Promise.all([
        supabase.from('stages').select('stage, is_open'),
        supabase.from('users').select('id, alias')
      ])

      const statusMap = {}
      for (const s of stageData || []) statusMap[s.stage] = s.is_open ? 'open' : 'locked'
      setStageStatus(statusMap)
      setUsers(userData || [])

      await fetchStage('Group', uid)
    }
    init()
  }, [])

  function handleStageChange(stage) {
    setActiveStage(stage)
    fetchStage(stage, userId)
  }

  const groupedMatches = matches.reduce((acc, match) => {
    const key = match.match_group || 'Matches'
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const sortedGroups = Object.entries(groupedMatches).sort(([a], [b]) => a.localeCompare(b))
  const status = stageStatus[activeStage] || 'open'
  const totalMatches = matches.length
  const betsPlaced = bets.length
  const bettingComplete = totalMatches > 0 && betsPlaced === totalMatches

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#f4f5f7' }}>

      {/* Header */}
      <div className="flex-shrink-0" style={{ background: '#0a5c45' }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">⚽</span>
            <h1 className="text-xl font-medium text-white tracking-tight">Matches</h1>
          </div>
          <LogoutButton />
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-hide">
          {STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap
                ${activeStage === stage
                  ? 'bg-white text-[#0a5c45] border-white'
                  : 'bg-transparent border-white/25 text-white/65'
                }`}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      {/* Bet progress banner */}
      {status === 'open' && !loading && !error && matches.length > 0 && (
        <div
          className="flex-shrink-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: bettingComplete ? '#e1f5ee' : '#ffffff',
            borderBottom: bettingComplete ? 'none' : '0.5px solid #e8e8e8',
          }}
        >
          <span style={{ fontSize: 11, color: bettingComplete ? '#0a5c45' : '#888', whiteSpace: 'nowrap' }}>
            Bets placed
          </span>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: bettingComplete ? '#9FE1CB' : '#e4e4e4' }}>
            <div style={{
              width: `${(betsPlaced / totalMatches) * 100}%`,
              height: '100%',
              borderRadius: 3,
              background: bettingComplete ? '#0a5c45' : '#1D9E75',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#0a5c45', whiteSpace: 'nowrap' }}>
            {bettingComplete ? `✓ ${totalMatches}/${totalMatches}` : `${betsPlaced}/${totalMatches}`}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pt-3" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        {error ? (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        ) : loading ? (
          <p className="text-sm text-gray-400 text-center mt-8">Loading...</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No matches yet for this stage.</p>
        ) : (
          sortedGroups.map(([group, groupMatches]) => (
            <div key={group}>
              {activeStage === 'Group' && (
                <div className="mt-4 mb-2" onClick={() => toggleGroup(group)}>
                  <span className="cursor-pointer text-xs bg-gray-200 text-gray-500 px-3 py-1 rounded-full font-medium inline-flex items-center gap-2">
                    {isCollapsed(group) ? `Group ${group} ▸` : `Group ${group} ▾`}
                    {isCollapsed(group) && (
                      <span className="flex items-center gap-0.5">
                        {getGroupTeams(group).map(team => {
                          const code = FLAGS[team]
                          if (!code) return null
                          return (
                            <img
                              key={team}
                              src={`https://flagcdn.com/w40/${code}.png`}
                              alt={team}
                              className="rounded-sm"
                              style={{ width: '1rem', height: 'auto' }}
                            />
                          )
                        })}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {!isCollapsed(group) && groupMatches.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  status={status}
                  userId={userId}
                  bets={bets.filter(b => b.match_id === match.id)}
                  users={users}
                  formatTime={formatTime}
                  onBetSaved={(newBet) => {
                    setBets(prev => {
                      const exists = prev.find(b => b.id === newBet.id)
                      const updated = exists
                        ? prev.map(b => b.id === newBet.id ? newBet : b)
                        : [...prev, newBet]
                      if (stageCache.current[activeStage]) {
                        stageCache.current[activeStage].bets = updated
                      }
                      return updated
                    })
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>

    </div>
  )
}
