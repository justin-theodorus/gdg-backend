'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole, JWTPayload } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  setToken: (token: string) => void
  setUser: (user: User) => void
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  fetchCurrentUser: () => Promise<void>
  isAuthenticated: () => boolean
  isStaff: () => boolean
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            set({ 
              isLoading: false, 
              error: data.error?.message || 'Login failed' 
            })
            return false
          }

          set({ 
            token: data.data.token, 
            user: data.data.user,
            isLoading: false,
            error: null 
          })
          
          return true
        } catch (err) {
          set({ 
            isLoading: false, 
            error: 'Network error. Please try again.' 
          })
          return false
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null })
      },

      fetchCurrentUser: async () => {
        const { token } = get()
        if (!token) return

        set({ isLoading: true })

        try {
          const response = await fetch('/api/auth/me', {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json' 
            },
          })

          const data = await response.json()

          if (response.ok && data.success) {
            set({ user: data.data.user, isLoading: false })
          } else {
            // Token invalid, logout
            set({ token: null, user: null, isLoading: false })
          }
        } catch {
          set({ isLoading: false })
        }
      },

      isAuthenticated: () => {
        const { token, user } = get()
        return !!token && !!user
      },

      isStaff: () => {
        const { user } = get()
        return user?.role === 'staff'
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'careconnect-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
