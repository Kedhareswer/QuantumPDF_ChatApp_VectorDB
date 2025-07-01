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
  const startTime = performance.now()
  
  // Perform a small amount of real processing to measure latency
  const testData = { test: "ping", iterations: 1000 }
  for (let i = 0; i < testData.iterations; i++) {
    JSON.stringify(testData)
  }
  
  const endTime = performance.now()
  const actualLatency = endTime - startTime
  
  return NextResponse.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    latency: Math.round(actualLatency * 100) / 100 // Real processing time in ms
  })
} 