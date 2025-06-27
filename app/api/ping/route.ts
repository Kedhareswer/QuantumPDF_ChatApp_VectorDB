import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    server: "quantum-pdf-chatapp"
  })
}

export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache'
    }
  })
}

export async function POST() {
  return NextResponse.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    latency: Math.random() * 50 + 10 // Simulated processing time
  })
} 