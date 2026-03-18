import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const { id, timestamp, content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ ok: true })

  // Check already processed
  const existing = db.prepare(
    'SELECT id FROM proposed_tasks WHERE source_entry_id = ?'
  ).get(id)
  if (existing) return NextResponse.json({ ok: true })

  // Call Ollama for task extraction
  let proposed: Array<{ title: string; project: string | null; priority: string; status: string }> = []

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt: `Extract actionable tasks from this text. Return ONLY a valid JSON array, no explanation, no markdown.
Each object must have: title (string), project (string or null), priority (now/soon/later), status (active/waiting/someday).
If there are no actionable tasks, return an empty array [].

Text:
${content}`,
        stream: false,
      }),
    })

    if (ollamaRes.ok) {
      const data = await ollamaRes.json()
      const raw = data.response?.trim() ?? ''
      const clean = raw.replace(/```json|```/g, '').trim()
      proposed = JSON.parse(clean)
    }
  } catch {
    // Ollama unavailable or parse failed — skip extraction silently
    return NextResponse.json({ ok: true })
  }

  // Store proposed tasks
  const insert = db.prepare(`
    INSERT INTO proposed_tasks (id, title, project, priority, status, source_text, source_entry_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  for (const task of proposed) {
    if (!task.title?.trim()) continue
    insert.run(
      randomUUID(),
      task.title.trim(),
      task.project ?? null,
      ['now', 'soon', 'later'].includes(task.priority) ? task.priority : 'soon',
      ['active', 'waiting', 'someday'].includes(task.status) ? task.status : 'active',
      content,
      id,
      now
    )
  }

  return NextResponse.json({ ok: true, extracted: proposed.length })
}
