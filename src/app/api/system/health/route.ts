import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/system/health - Health check endpoint
export async function GET() {
  const startTime = Date.now()
  
  // Check database connection
  let dbStatus = 'healthy'
  let dbLatency = 0
  
  try {
    const dbStart = Date.now()
    const { error } = await supabase.from('programs').select('id').limit(1)
    dbLatency = Date.now() - dbStart
    
    if (error) {
      dbStatus = 'degraded'
    }
  } catch {
    dbStatus = 'unhealthy'
  }

  const totalLatency = Date.now() - startTime

  const health = {
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services: {
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
      },
    },
    latency_ms: totalLatency,
  }

  const statusCode = health.status === 'healthy' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}
