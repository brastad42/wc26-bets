'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import MatchCard from './components/MatchCard'

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
  'Portugal': 'pt', 'Congo': 'cg', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
}

function formatTime(utcString) {
  const date = new Date(utcString)
  const weekday = date.toLocaleString('en-GB', { timeZone: 'Europe/Oslo', weekday: 'short' })
  const rest = date.toLocaleString('en-GB', {
    timeZone: 'Europe/Oslo',
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
    return collapsedGroups[group] === undefined ? true : collapsedGroups[group]
  }

  function getGroupTeams(group) {
    const groupMatches = matches.filter(m => m.stage === 'Group' && m.match_group === group)
    const teams = new Set()
    for (const m of groupMatches) {
      teams.add(m.home_team)
      teams.add(m.away_team)
    }
    return [...teams].slice(0, 4)
  }

  useEffect(() => {
    async function init() {
      const id = localStorage.getItem('userId')
      setUserId(id)
    }
    init()
  }, [])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const [{ data: matchData }, { data: stageData }, { data: betData }, { data: userData }] =
        await Promise.all([
          supabase.from('matches').select('*').order('match_time'),
          supabase.from('stages').select('*'),
          supabase.from('bets').select('*'),
          supabase.from('users').select('id, alias')
        ])

      setMatches(matchData || [])
      setBets(betData || [])
      setUsers(userData || [])

      const statusMap = {}
      for (const s of stageData || []) {
        statusMap[s.stage] = s.is_open ? 'open' : 'locked'
      }
      setStageStatus(statusMap)
      setLoading(false)
    }

    fetchData()
  }, [])

  const filteredMatches = matches.filter(m => m.stage === activeStage)

  const groupedMatches = filteredMatches.reduce((acc, match) => {
    const key = match.match_group || 'Matches'
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {})

  const sortedGroups = Object.entries(groupedMatches).sort(([a], [b]) => a.localeCompare(b))

  const status = stageStatus[activeStage] || 'open'

  return (
    <div className="min-h-screen pb-20" style={{ background: '#f4f5f7' }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-40" style={{ background: '#0a5c45' }}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="text-2xl leading-none">⚽</span>
          <h1 className="text-xl font-medium text-white tracking-tight">Matches</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-hide">
          {STAGES.map(stage => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
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

      {/* Content */}
      <div className="px-3 pt-3">
        {loading ? (
          <p className="text-sm text-gray-400 text-center mt-8">Loading...</p>
        ) : filteredMatches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No matches yet for this stage.</p>
        ) : (
          sortedGroups.map(([group, groupMatches]) => (
            <div key={group}>
              <div
                className="mt-4 mb-2"
                onClick={() => activeStage === 'Group' && toggleGroup(group)}
              >
                {activeStage === 'Group' && (
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
                              className="w-4 rounded-sm"
                              style={{ height: 'auto' }}
                            />
                          )
                        })}
                      </span>
                    )}
                  </span>
                )}
              </div>
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
                      if (exists) return prev.map(b => b.id === newBet.id ? newBet : b)
                      return [...prev, newBet]
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