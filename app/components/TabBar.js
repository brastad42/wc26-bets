'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Matches',     href: '/matches',     emoji: '⚽' },
  { label: 'Leaderboard', href: '/leaderboard', emoji: '🏆' },
  { label: 'Chat',        href: '/chat',        emoji: '💬' },
  { label: 'Rules',       href: '/rules',       emoji: '📋' },
]

export default function TabBar() {
  const pathname = usePathname()
  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-around items-center h-16 px-2 z-50"
      style={{ background: '#0a5c45' }}>
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-0.5 flex-1 py-2"
          >
            <span
              className="text-[22px] leading-none"
              style={{ filter: active ? 'none' : 'grayscale(1) opacity(0.4) brightness(2)' }}
            >
              {tab.emoji}
            </span>
            <span className="text-[10px]"
              style={{ color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>
              {tab.label}
            </span>
            {active && <div className="w-1 h-1 rounded-full bg-white" />}
          </Link>
        )
      })}
    </div>
  )
}