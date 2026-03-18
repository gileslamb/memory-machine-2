import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET() {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all()
  const proposed = db.prepare('SELECT * FROM proposed_tasks ORDER BY created_at DESC').all()
  const projects = db.prepare('SELECT * FROM projects WHERE active = 1 ORDER BY name').all()
  const dailyLogs = db.prepare('SELECT * FROM daily_logs ORDER BY log_date DESC, created_at DESC').all()
  return NextResponse.json({ tasks, proposed, projects, dailyLogs })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { action } = body
  const now = new Date().toISOString()

  if (action === 'approve') {
    const { proposedId, title, project, priority, status } = body
    const taskId = randomUUID()
    db.prepare(`
      INSERT INTO tasks (id, title, project, area, status, priority, source_ref, created_at, updated_at)
      VALUES (?, ?, ?, null, ?, ?, ?, ?, ?)
    `).run(taskId, title, project ?? null, status, priority, proposedId, now, now)
    db.prepare('DELETE FROM proposed_tasks WHERE id = ?').run(proposedId)
    db.prepare(`
      INSERT INTO task_events (id, task_id, event_type, new_values, created_at)
      VALUES (?, ?, 'created', ?, ?)
    `).run(randomUUID(), taskId, JSON.stringify({ title, project, status, priority }), now)
    return NextResponse.json({ ok: true, taskId })
  }

  if (action === 'dismiss') {
    db.prepare('DELETE FROM proposed_tasks WHERE id = ?').run(body.proposedId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'create') {
    const { title, project, priority, status } = body
    const taskId = randomUUID()
    db.prepare(`
      INSERT INTO tasks (id, title, project, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, title, project ?? null, status ?? 'active', priority ?? 'soon', now, now)
    db.prepare(`
      INSERT INTO task_events (id, task_id, event_type, new_values, created_at)
      VALUES (?, ?, 'created', ?, ?)
    `).run(randomUUID(), taskId, JSON.stringify({ title, project, status, priority }), now)
    return NextResponse.json({ ok: true, taskId })
  }

  if (action === 'update') {
    const { taskId, ...fields } = body
    const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
    const allowed = ['title', 'project', 'status', 'priority', 'notes', 'area']
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([k]) => allowed.includes(k))
    )
    const setClauses = [...Object.keys(updates).map(k => `${k} = ?`), 'updated_at = ?'].join(', ')
    db.prepare(`UPDATE tasks SET ${setClauses} WHERE id = ?`)
      .run(...Object.values(updates), now, taskId)
    db.prepare(`
      INSERT INTO task_events (id, task_id, event_type, previous_values, new_values, created_at)
      VALUES (?, ?, 'updated', ?, ?, ?)
    `).run(randomUUID(), taskId, JSON.stringify(current), JSON.stringify(updates), now)
    return NextResponse.json({ ok: true })
  }

  if (action === 'done') {
    const { taskId } = body
    const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as { title: string; project: string | null }
    db.prepare('UPDATE tasks SET status = ?, done_at = ?, updated_at = ? WHERE id = ?')
      .run('done', now, now, taskId)
    db.prepare(`
      INSERT INTO task_events (id, task_id, event_type, previous_values, created_at)
      VALUES (?, ?, 'done', ?, ?)
    `).run(randomUUID(), taskId, JSON.stringify(current), now)
    db.prepare(`
      INSERT INTO daily_logs (id, task_id, task_title, project, log_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), taskId, current.title, current.project ?? null, now.split('T')[0], now)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
