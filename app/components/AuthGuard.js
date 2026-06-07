'use client'

import { useRequireUser } from '@/app/hooks/useRequireUser'

export default function AuthGuard({ children }) {
  const { checking } = useRequireUser()
  if (checking) return null
  return children
}
