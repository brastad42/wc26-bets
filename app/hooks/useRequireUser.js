'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useRequireUser() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const uid = localStorage.getItem('userId')
    if (!uid) {
      router.replace('/join')
    } else {
      setUserId(uid)
      setChecking(false)
    }
  }, [router])

  return { userId, checking }
}
