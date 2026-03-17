import { writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { entries } = await req.json()

  const exportDir = join(homedir(), 'Desktop', 'memory-machine-v2', 'exports')
  const exportPath = join(exportDir, 'mm-log-export.json')

  mkdirSync(exportDir, { recursive: true })

  const payload = {
    exported_at: new Date().toISOString(),
    entries: (entries || []).map((e: { id: string; ts: string; text: string }) => ({
      id: e.id,
      timestamp: e.ts,
      content: e.text,
    })),
  }

  writeFileSync(exportPath, JSON.stringify(payload, null, 2), 'utf-8')

  return NextResponse.json({ ok: true, exported_at: payload.exported_at })
}
