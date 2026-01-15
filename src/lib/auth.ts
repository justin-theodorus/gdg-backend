import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import type { JWTPayload, UserRole } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generate JWT token
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// Extract token from request
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return null
}

// Authenticate request and return user payload
export function authenticateRequest(request: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token)
}

// Check if user has required role
export function hasRole(user: JWTPayload, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role)
}

// Permission checks for different actions
export const permissions = {
  canCreateActivity: (role: UserRole) => role === 'staff',
  canModifyActivity: (role: UserRole) => role === 'staff',
  canViewAllBookings: (role: UserRole) => role === 'staff',
  canManageUsers: (role: UserRole) => role === 'staff',
  canViewAnalytics: (role: UserRole) => role === 'staff',
  canAssignVolunteers: (role: UserRole) => role === 'staff',
  canCheckInParticipants: (role: UserRole) => role === 'staff',
}

// Create error response for unauthorized access
export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json(
    {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    },
    { status: 401 }
  )
}

// Create error response for forbidden access
export function forbiddenResponse(message = 'Insufficient permissions') {
  return Response.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
      },
    },
    { status: 403 }
  )
}
