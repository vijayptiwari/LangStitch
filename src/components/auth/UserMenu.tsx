import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import './auth.css'

function initials(name: string | null, email: string | null): string {
  const source = name || email || '?'
  const parts = source.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const enabled = useAuthStore((s) => s.enabled)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!enabled || !user) return null

  const displayName = user.name || user.email || 'Account'

  return (
    <div className="user-menu" ref={ref} data-testid="user-menu">
      <button
        type="button"
        className="user-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="user-chip"
      >
        {user.avatar_url ? (
          <img className="user-avatar" src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-avatar">{initials(user.name, user.email)}</span>
        )}
        <span className="user-name">{displayName}</span>
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          {user.email && <div className="user-dropdown-email">{user.email}</div>}
          <button
            type="button"
            className="user-dropdown-item"
            role="menuitem"
            data-testid="user-logout"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
