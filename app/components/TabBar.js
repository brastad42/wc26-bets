'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    label: 'Matches',
    href: '/matches',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke={active ? '#1D9E75' : '#9ca3af'} strokeWidth="1.5"/>
        <path d="M10 6v4l3 2" stroke={active ? '#1D9E75' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    label: 'Leaderboard',
    href: '/leaderboard',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="10" width="3" height="7" rx="1" fill={active ? '#1D9E75' : '#9ca3af'}/>
        <rect x="8.5" y="6" width="3" height="11" rx="1" fill={active ? '#1D9E75' : '#9ca3af'}/>
        <rect x="14" y="3" width="3" height="14" rx="1" fill={active ? '#1D9E75' : '#9ca3af'}/>
      </svg>
    )
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-4 3V5a1 1 0 011-1z" stroke={active ? '#1D9E75' : '#9ca3af'} strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    label: 'Rules',
    href: '/rules',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="2" width="12" height="16" rx="2" stroke={active ? '#1D9E75' : '#9ca3af'} strokeWidth="1.5"/>
        <path d="M7 7h6M7 10h6M7 13h4" stroke={active ? '#1D9E75' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
]

export default function TabBar() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 px-2 z-50">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-1 flex-1 py-2"
          >
            {tab.icon(active)}
            <span className={`text-xs ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}