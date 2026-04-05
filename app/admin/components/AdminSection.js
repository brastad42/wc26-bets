'use client'

import { useState } from 'react'

export default function AdminSection({ title, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex justify-between items-center px-4 py-3"
      >
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {title}
        </p>
        <span className="text-gray-500 text-base">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}