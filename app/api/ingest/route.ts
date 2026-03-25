import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { randomUUID } from 'crypto'

function buildExtractionPrompt(
  content: string,
  ctx: {
    existingLines: string[]
    canonicalProjects: string[]
  }
): string {
  const existingBlock =
    ctx.existingLines.length > 0
      ? ctx.existingLines.map(l => `- ${l}`).join('\n')
      : '(none)'

  const projectsBlock =
    ctx.canonicalProjects.length > 0
      ? ctx.canonicalProjects.map(p => `- ${p}`).join('\n')
      : '(none — infer sensible names only if needed; prefer null for one-off actions)'

  return `You extract tasks from a short log entry for a personal task system.

## Rules (strict)
1. **Deduplicate**: Do NOT output a task if it is the same as, or substantially the same as, any task listed under "Existing tasks & proposals" (same intent, reworded, or minor variation). Skip duplicates entirely.
2. **Actionable only**: Include ONLY tasks with a single, clear, concrete next action someone could complete in one sitting (roughly under 2 hours). REJECT: broad goals, vague intentions, themes, habits without a specific step, multi-step projects stated as one line, "think about", "focus on", "explore", "improve", "work on X" without a concrete deliverable.
3. **Project field**: When the action clearly belongs to a named initiative, set "project" to the **canonical** project name (see list below). Use **exactly** one name from the canonical list when it matches — do NOT create spelling variants or subtitles (e.g. use "Signal Dreams" not "Signal Dreams AV"). If nothing fits, set "project" to null or omit.
4. **Title**: Short, imperative, specific. Describe ONE action only — NOT "[Project] — action" in the title; put the project in the "project" field and keep "title" as the action line only (e.g. title: "Add MIDI velocity mapping to particle density", project: "TouchDesigner Organism").
5. **Project consolidation**: Before inventing a new project name, check the canonical list for an existing name that means the same thing (abbreviations, version numbers, extra words). Reuse that exact string.

## Canonical project names (reuse exactly when applicable)
${projectsBlock}

## Existing tasks & proposals (do not duplicate)
${existingBlock}

## Output format
Return ONLY a valid JSON array. No markdown fences, no commentary.
Each object: {"title": string, "project": string | null, "priority": "now"|"soon"|"later", "status": "active"|"waiting"|"someday"}
If nothing qualifies, return []

## Log entry
${content}`
}

export async function POST(req: Request) {
  const body = await req.json()
  const { id, timestamp, content, knownProjects: knownProjectsRaw } = body
  if (!content?.trim()) return NextResponse.json({ ok: true })

  // Check already processed
  const existing = db.prepare(
    'SELECT id FROM proposed_tasks WHERE source_entry_id = ?'
  ).get(id)
  if (existing) return NextResponse.json({ ok: true })

  const activeRows = db.prepare(
    `SELECT title, project FROM tasks WHERE status NOT IN ('done', 'archived')`
  ).all() as { title: string; project: string | null }[]

  const proposedRows = db.prepare(
    'SELECT title, project FROM proposed_tasks'
  ).all() as { title: string; project: string | null }[]

  const dbProjectRows = db.prepare(
    'SELECT name FROM projects WHERE active = 1'
  ).all() as { name: string }[]

  const knownFromClient = Array.isArray(knownProjectsRaw)
    ? knownProjectsRaw.filter((p: unknown) => typeof p === 'string' && p.trim())
    : []

  const canonicalSet = new Set<string>()
  for (const p of dbProjectRows) canonicalSet.add(p.name)
  for (const p of knownFromClient) canonicalSet.add(p.trim())
  for (const t of activeRows) {
    if (t.project?.trim()) canonicalSet.add(t.project.trim())
  }
  for (const t of proposedRows) {
    if (t.project?.trim()) canonicalSet.add(t.project.trim())
  }
  const canonicalProjects = Array.from(canonicalSet).sort()

  const existingLines: string[] = []
  for (const t of activeRows) {
    const proj = t.project?.trim()
    existingLines.push(proj ? `${t.title}  [${proj}]` : t.title)
  }
  for (const t of proposedRows) {
    const proj = t.project?.trim()
    existingLines.push(proj ? `${t.title}  [${proj}]` : t.title)
  }

  let proposed: Array<{ title: string; project: string | null; priority: string; status: string }> = []

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt: buildExtractionPrompt(content, { existingLines, canonicalProjects }),
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
    return NextResponse.json({ ok: true })
  }

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
