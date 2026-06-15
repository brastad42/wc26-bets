'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  function handleLogout() {
    localStorage.removeItem('userId')
    localStorage.removeItem('matchesSortMode')
    localStorage.removeItem('competitionId')
    router.push('/join')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-medium px-2 py-1 rounded"
      style={{ color: 'rgba(255,255,255,0.45)' }}
    >
      Log out
    </button>
  )
}
