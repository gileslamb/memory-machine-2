'use client'

import { useState, useEffect, useRef } from 'react'

const STABLE_KEY = 'mm_stable'
const LOG_KEY = 'mm_log'

interface LogEntry {
  id: string
  ts: string
  text: string
  area?: string
}

const AREAS = ['projects', 'admin', 'vision', 'life', 'general']

const DEFAULT_STABLE = `# AI_CONTEXT_STABLE
*Last synthesised: ${new Date().toISOString().split('T')[0]}*

## Identity
Giles — UK-based creative technologist, performer, composer. Based in Bearsden, Scotland.
Works across: live generative visual performance, ambient/cinematic music, live AV, web development.
Has ADHD — needs low-friction, near-automatic workflows. Prefers voice input. Structure must be invisible.

## Active Projects
- **organism** — TouchDesigner generative visual system driven by MPE MIDI from Expressive E Osmose. Berlin performance approaching.
- **Signal Dreams** — live ambient AV performance project.
- **DTTM** — cinematic album. Next.js/Three.js website deployed. Collaborating with Florian (video editor).
- **Hushabye Lullaby** — website build in progress.
- Music projects: Curious Dreamers, Tier Reno, Diddy Das Dreamland, songwriting for Evie.
- Potential collaborators: Marie, Alex.

## Tools & Stack
- Creative/production: TouchDesigner, Expressive E Osmose (MPE MIDI)
- Web dev: Next.js, Three.js, Cursor with Claude Code
- AI: Claude (primary), ChatGPT (strategic synthesis), Ollama (qwen3:8b, qwen3:32b local)
- Notes/admin: Bear, Google Drive, Google Sheets, Basecamp, Campfire
- Productivity: Fantastical, Apple Reminders

## Memory Machine System
- AI_CONTEXT_STABLE.md — cleaned master context, updated weekly via claude.ai or ChatGPT
- AI_CONTEXT_LOG.md — append-only daily entries, no synthesis
- Weekly synthesis: paste both files into claude.ai subscription (free), get refreshed STABLE back
- Local model (Ollama qwen3:8b) for append only — no API calls for routine logging

## Working Principles
- Low friction above all else — if it takes more than 20 seconds, it won't get used
- RAM constraint: qwen3:32b loads on demand only, not resident during creative sessions
- Dual purpose: AI context generation + human self-reflection
- Local-first, Google Drive sync for backup
`

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function groupByDay(entries: LogEntry[]) {
  const groups: Record<string, LogEntry[]> = {}
  entries.forEach(e => {
    const day = e.ts.split('T')[0]
    if (!groups[day]) groups[day] = []
    groups[day].push(e)
  })
  return groups
}

export default function MemoryMachine() {
  const [stable, setStable] = useState(DEFAULT_STABLE)
  const [log, setLog] = useState<LogEntry[]>([])
  const [input, setInput] = useState('')
  const [area, setArea] = useState('general')
  const [view, setView] = useState<'log' | 'stable' | 'export' | 'tasks'>('log')
  const [copied, setCopied] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [editingStable, setEditingStable] = useState(false)
  const [stableDraft, setStableDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [tasks, setTasks] = useState<any[]>([])
  const [proposed, setProposed] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [dailyLogs, setDailyLogs] = useState<any[]>([])
  const [taskSubView, setTaskSubView] = useState<'reconcile' | 'today' | 'done'>('reconcile')
  const [taskFilter, setTaskFilter] = useState<'active' | 'waiting' | 'someday' | 'all'>('active')
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskProject, setNewTaskProject] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('soon')

  useEffect(() => {
    const s = localStorage.getItem(STABLE_KEY)
    const l = localStorage.getItem(LOG_KEY)
    if (s) setStable(s)
    if (l) setLog(JSON.parse(l))
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  async function loadTasks() {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(data.tasks)
    setProposed(data.proposed)
    setProjects(data.projects)
    setDailyLogs(data.dailyLogs)
  }

  async function checkOllama() {
    try {
      await fetch('http://localhost:11434/', { signal: AbortSignal.timeout(2000) })
      setOllamaOk(true)
    } catch {
      setOllamaOk(false)
    }
  }

  useEffect(() => {
    if (view === 'tasks') {
      loadTasks()
      checkOllama()
    }
  }, [view])

  function saveLog(entries: LogEntry[]) {
    setLog(entries)
    localStorage.setItem(LOG_KEY, JSON.stringify(entries))
  }

  function saveStable(text: string) {
    setStable(text)
    localStorage.setItem(STABLE_KEY, text)
  }

  function addEntry() {
    if (!input.trim()) return
    const entry: LogEntry = {
      id: Date.now().toString(),
      ts: new Date().toISOString(),
      text: input.trim(),
      area: area !== 'general' ? area : undefined
    }
    saveLog([entry, ...log])
    fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: entry.id,
        timestamp: entry.ts,
        content: entry.text,
      }),
    }).catch(() => {})
    setInput('')
    inputRef.current?.focus()
  }

  function deleteEntry(id: string) {
    saveLog(log.filter(e => e.id !== id))
  }

  function buildExport() {
    const logMd = log.length === 0 ? '*No entries yet.*' :
      Object.entries(groupByDay([...log].reverse()))
        .reverse()
        .map(([day, entries]) => {
          const header = `## ${new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
          const lines = entries.reverse().map(e =>
            `### ${new Date(e.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}${e.area ? ` · ${e.area}` : ''}\n${e.text}`
          ).join('\n\n')
          return header + '\n\n' + lines
        }).join('\n\n---\n\n')

    return `---
WEEKLY SYNTHESIS REQUEST
Paste this into claude.ai or ChatGPT with the prompt below.
---

PROMPT:
Merge the following append-only context log into the stable context document. 
Consolidate duplicates, remove stale details, preserve enduring preferences 
and active priorities. Return a clean updated AI_CONTEXT_STABLE.md in markdown.

---
# AI_CONTEXT_STABLE.md

${stable}

---
# AI_CONTEXT_LOG.md

${logMd}
`
  }

  async function copyExport() {
    await navigator.clipboard.writeText(buildExport())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyStable() {
    await navigator.clipboard.writeText(stable)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function clearLog() {
    if (confirm('Clear all log entries? Make sure you\'ve done your weekly synthesis first.')) {
      saveLog([])
    }
  }

  async function handleExport() {
    const entries = log.map(e => ({ id: e.id, ts: e.ts, text: e.text }))
    const res = await fetch('/api/export-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    if (res.ok) {
      const { exported_at } = await res.json()
      setExportMessage(`Log exported — ${new Date(exported_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
      setTimeout(() => setExportMessage(null), 3000)
    }
  }

  async function approveTask(p: any) {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        proposedId: p.id,
        title: p.title,
        project: p.project,
        priority: p.priority,
        status: p.status,
      }),
    })
    await loadTasks()
  }

  async function dismissTask(proposedId: string) {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', proposedId }),
    })
    await loadTasks()
  }

  async function markDone(taskId: string) {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'done', taskId }),
    })
    await loadTasks()
  }

  async function updateTask(taskId: string, fields: Record<string, string>) {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', taskId, ...fields }),
    })
    await loadTasks()
  }

  async function addQuickTask() {
    if (!newTaskTitle.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        title: newTaskTitle.trim(),
        project: newTaskProject || null,
        priority: newTaskPriority,
        status: 'active',
      }),
    })
    setNewTaskTitle('')
    await loadTasks()
  }

  async function copyDoneLog() {
    const today = new Date().toISOString().split('T')[0]
    const todayDone = dailyLogs.filter((l: any) => l.log_date === today)
    if (todayDone.length === 0) return
    const lines = todayDone.map((l: any) =>
      `- ${l.task_title}${l.project ? `  [${l.project}]` : ''}`
    ).join('\n')
    const md = `## Done — ${today}\n${lines}`
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const todayKey = new Date().toISOString().split('T')[0]
  const todayEntries = log.filter(e => e.ts.startsWith(todayKey))
  const groups = groupByDay([...log].reverse())

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e8e4dc',
      fontFamily: '"IBM Plex Mono", "Courier New", monospace',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #222',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0d0d0d',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.15em', color: '#c8b89a' }}>
            MEMORY MACHINE
          </span>
          <span style={{ fontSize: 11, color: '#444', letterSpacing: '0.1em' }}>v2</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['log', 'stable', 'export', 'tasks'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? '#1a1a1a' : 'transparent',
              border: view === v ? '1px solid #333' : '1px solid transparent',
              color: view === v ? '#e8e4dc' : '#555',
              padding: '4px 12px',
              fontSize: 11,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              borderRadius: 3,
              textTransform: 'uppercase',
            }}>
              {v}
            </button>
          ))}
          {view === 'log' && (
            <>
              {exportMessage && (
                <span style={{ fontSize: 10, color: '#c8b89a', letterSpacing: '0.08em' }}>{exportMessage}</span>
              )}
              <button onClick={handleExport} style={btnStyle('#c8b89a', '#0a0a0a')}>
                Export log
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Add — always visible */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1a1a1a',
        background: '#0d0d0d',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            style={{
              background: '#141414',
              border: '1px solid #2a2a2a',
              color: '#888',
              padding: '8px 10px',
              fontSize: 11,
              letterSpacing: '0.08em',
              borderRadius: 3,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addEntry() }}
            placeholder="what's happening... (enter to log)"
            style={{
              flex: 1,
              background: '#141414',
              border: '1px solid #2a2a2a',
              color: '#e8e4dc',
              padding: '8px 14px',
              fontSize: 13,
              borderRadius: 3,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={addEntry}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? '#c8b89a' : '#1a1a1a',
              border: 'none',
              color: input.trim() ? '#0a0a0a' : '#333',
              padding: '8px 16px',
              fontSize: 11,
              letterSpacing: '0.1em',
              cursor: input.trim() ? 'pointer' : 'default',
              borderRadius: 3,
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            LOG
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#333', letterSpacing: '0.08em' }}>
          {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'} today
          {log.length > todayEntries.length && ` · ${log.length} total`}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {view === 'log' && (
          <div>
            {log.length === 0 ? (
              <div style={{ color: '#333', fontSize: 12, letterSpacing: '0.08em', paddingTop: 20 }}>
                no entries yet. start logging above.
              </div>
            ) : (
              Object.entries(groups).reverse().map(([day, entries]) => (
                <div key={day} style={{ marginBottom: 32 }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: '#555',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                    paddingBottom: 6,
                    borderBottom: '1px solid #1a1a1a',
                  }}>
                    {new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {entries.map(entry => (
                    <div key={entry.id} style={{
                      display: 'flex',
                      gap: 12,
                      marginBottom: 8,
                      padding: '8px 0',
                      borderBottom: '1px solid #141414',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{ fontSize: 10, color: '#444', whiteSpace: 'nowrap', paddingTop: 2, minWidth: 80 }}>
                        {new Date(entry.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {entry.area && (
                        <span style={{
                          fontSize: 9,
                          letterSpacing: '0.1em',
                          color: '#c8b89a',
                          textTransform: 'uppercase',
                          paddingTop: 3,
                          minWidth: 55,
                        }}>
                          {entry.area}
                        </span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: '#d4cfc7' }}>
                        {entry.text}
                      </span>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#333',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: '0 4px',
                          lineHeight: 1,
                        }}
                        title="delete"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
            {log.length > 0 && (
              <button onClick={clearLog} style={{
                background: 'none',
                border: '1px solid #2a2a2a',
                color: '#444',
                padding: '6px 14px',
                fontSize: 10,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                borderRadius: 3,
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                marginTop: 12,
              }}>
                clear log after synthesis
              </button>
            )}
          </div>
        )}

        {view === 'stable' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AI_CONTEXT_STABLE.md
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingStable ? (
                  <>
                    <button onClick={() => { saveStable(stableDraft); setEditingStable(false) }} style={btnStyle('#c8b89a', '#0a0a0a')}>save</button>
                    <button onClick={() => setEditingStable(false)} style={btnStyle('#1a1a1a', '#888')}>cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={copyStable} style={btnStyle('#1a1a1a', copied ? '#c8b89a' : '#888')}>
                      {copied ? 'copied!' : 'copy'}
                    </button>
                    <button onClick={() => { setStableDraft(stable); setEditingStable(true) }} style={btnStyle('#1a1a1a', '#888')}>edit</button>
                  </>
                )}
              </div>
            </div>
            {editingStable ? (
              <textarea
                value={stableDraft}
                onChange={e => setStableDraft(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '60vh',
                  background: '#0d0d0d',
                  border: '1px solid #2a2a2a',
                  color: '#e8e4dc',
                  padding: 16,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  lineHeight: 1.7,
                  borderRadius: 3,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <pre style={{
                background: '#0d0d0d',
                border: '1px solid #1a1a1a',
                padding: 20,
                fontSize: 12,
                lineHeight: 1.7,
                borderRadius: 3,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#c8c4bc',
              }}>
                {stable}
              </pre>
            )}
          </div>
        )}

        {view === 'export' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                weekly synthesis export
              </span>
              <button onClick={copyExport} style={btnStyle('#c8b89a', '#0a0a0a')}>
                {copied ? '✓ copied to clipboard' : 'copy all — paste into claude.ai'}
              </button>
            </div>
            <div style={{
              background: '#0d0d0d',
              border: '1px solid #1a1a1a',
              borderRadius: 3,
              padding: 20,
              fontSize: 11,
              color: '#666',
              lineHeight: 1.8,
              marginBottom: 16,
            }}>
              <div style={{ color: '#888', marginBottom: 8, fontSize: 12 }}>How to use this:</div>
              <div>1. Click "copy all" above</div>
              <div>2. Open claude.ai (uses your subscription, not the API)</div>
              <div>3. Paste and send</div>
              <div>4. Copy the new AI_CONTEXT_STABLE.md back into the STABLE tab</div>
              <div>5. Clear the log</div>
            </div>
            <pre style={{
              background: '#0d0d0d',
              border: '1px solid #1a1a1a',
              padding: 20,
              fontSize: 11,
              lineHeight: 1.7,
              borderRadius: 3,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#555',
              maxHeight: '60vh',
              overflow: 'auto',
            }}>
              {buildExport()}
            </pre>
          </div>
        )}

        {view === 'tasks' && (
          <div>
            {ollamaOk === false && (
              <div style={{
                background: '#1a1200', border: '1px solid #3a2800',
                color: '#c8a050', padding: '8px 14px', borderRadius: 3,
                fontSize: 11, letterSpacing: '0.08em', marginBottom: 16,
              }}>
                local ai unavailable — manual task entry still works
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {(['reconcile', 'today', 'done'] as const).map(sv => (
                <button key={sv} onClick={() => setTaskSubView(sv)} style={{
                  background: taskSubView === sv ? '#1a1a1a' : 'transparent',
                  border: taskSubView === sv ? '1px solid #333' : '1px solid transparent',
                  color: taskSubView === sv ? '#e8e4dc' : '#555',
                  padding: '4px 12px', fontSize: 11, letterSpacing: '0.1em',
                  cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}>
                  {sv}
                  {sv === 'reconcile' && proposed.length > 0 && (
                    <span style={{
                      marginLeft: 6, background: '#c8b89a', color: '#0a0a0a',
                      borderRadius: 8, padding: '0 5px', fontSize: 9, fontWeight: 700,
                    }}>
                      {proposed.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex', gap: 8, marginBottom: 24,
              paddingBottom: 20, borderBottom: '1px solid #1a1a1a',
            }}>
              <input
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addQuickTask() }}
                placeholder="add task..."
                style={{
                  flex: 1, background: '#141414', border: '1px solid #2a2a2a',
                  color: '#e8e4dc', padding: '7px 12px', fontSize: 12,
                  borderRadius: 3, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <select
                value={newTaskProject}
                onChange={e => setNewTaskProject(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid #2a2a2a', color: '#888',
                  padding: '7px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">no project</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <select
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value)}
                style={{
                  background: '#141414', border: '1px solid #2a2a2a', color: '#888',
                  padding: '7px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="now">now</option>
                <option value="soon">soon</option>
                <option value="later">later</option>
              </select>
              <button onClick={addQuickTask} disabled={!newTaskTitle.trim()} style={{
                background: newTaskTitle.trim() ? '#c8b89a' : '#1a1a1a',
                border: 'none', color: newTaskTitle.trim() ? '#0a0a0a' : '#333',
                padding: '7px 14px', fontSize: 11, letterSpacing: '0.1em',
                cursor: newTaskTitle.trim() ? 'pointer' : 'default',
                borderRadius: 3, fontFamily: 'inherit', fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                add
              </button>
            </div>

            {taskSubView === 'reconcile' && (
              <div>
                {proposed.length === 0 ? (
                  <div style={{ color: '#333', fontSize: 12, letterSpacing: '0.08em' }}>
                    no proposed tasks. log an entry to extract tasks automatically.
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontSize: 10, color: '#555', letterSpacing: '0.12em',
                      textTransform: 'uppercase', marginBottom: 12,
                    }}>
                      {proposed.length} proposed {proposed.length === 1 ? 'task' : 'tasks'} from your log
                    </div>
                    {proposed.map((p: any) => (
                      <div key={p.id} style={{
                        background: '#0d0d0d', border: '1px solid #222',
                        borderRadius: 3, padding: '12px 14px', marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 13, color: '#e8e4dc', marginBottom: 8 }}>{p.title}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.project && (
                            <span style={{
                              fontSize: 9, letterSpacing: '0.1em', color: '#c8b89a',
                              textTransform: 'uppercase',
                            }}>
                              {p.project}
                            </span>
                          )}
                          <span style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {p.priority} · {p.status}
                          </span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            <button onClick={() => approveTask(p)} style={btnStyle('#c8b89a', '#0a0a0a')}>add</button>
                            <button onClick={() => dismissTask(p.id)} style={btnStyle('#1a1a1a', '#666')}>dismiss</button>
                          </div>
                        </div>
                        {p.source_text && (
                          <div style={{
                            marginTop: 8, fontSize: 10, color: '#333',
                            borderTop: '1px solid #1a1a1a', paddingTop: 6,
                            fontStyle: 'italic',
                          }}>
                            {p.source_text.length > 120 ? p.source_text.slice(0, 120) + '…' : p.source_text}
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={async () => { for (const p of proposed) await approveTask(p) }}
                        style={btnStyle('#c8b89a', '#0a0a0a')}
                      >
                        add all
                      </button>
                      <button
                        onClick={async () => { for (const p of proposed) await dismissTask(p.id) }}
                        style={btnStyle('#1a1a1a', '#666')}
                      >
                        dismiss all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {taskSubView === 'today' && (
              <div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {(['active', 'waiting', 'someday', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)} style={{
                      background: taskFilter === f ? '#1a1a1a' : 'transparent',
                      border: taskFilter === f ? '1px solid #333' : '1px solid transparent',
                      color: taskFilter === f ? '#e8e4dc' : '#444',
                      padding: '3px 10px', fontSize: 10, letterSpacing: '0.1em',
                      cursor: 'pointer', borderRadius: 3, textTransform: 'uppercase',
                      fontFamily: 'inherit',
                    }}>{f}</button>
                  ))}
                </div>

                {(['now', 'soon', 'later'] as const).map(priority => {
                  const filtered = tasks.filter((t: any) =>
                    t.priority === priority &&
                    t.status !== 'done' && t.status !== 'archived' &&
                    (taskFilter === 'all' || t.status === taskFilter)
                  )
                  if (filtered.length === 0) return null
                  return (
                    <div key={priority} style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 10, color: '#555', letterSpacing: '0.15em',
                        textTransform: 'uppercase', marginBottom: 10,
                        paddingBottom: 6, borderBottom: '1px solid #1a1a1a',
                      }}>
                        {priority}
                      </div>
                      {filtered.map((t: any) => (
                        <div key={t.id} style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          padding: '8px 0', borderBottom: '1px solid #141414',
                        }}>
                          <button
                            onClick={() => markDone(t.id)}
                            title="mark done"
                            style={{
                              width: 16, height: 16, borderRadius: '50%',
                              border: '1px solid #444', background: 'none',
                              cursor: 'pointer', flexShrink: 0, marginTop: 2,
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#d4cfc7' }}>{t.title}</div>
                            {t.project && (
                              <div style={{ fontSize: 10, color: '#c8b89a', letterSpacing: '0.08em', marginTop: 2 }}>
                                {t.project}
                              </div>
                            )}
                          </div>
                          <select
                            value={t.status}
                            onChange={e => updateTask(t.id, { status: e.target.value })}
                            style={{
                              background: '#141414', border: '1px solid #222',
                              color: '#555', fontSize: 10, padding: '2px 6px',
                              borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <option value="active">active</option>
                            <option value="waiting">waiting</option>
                            <option value="someday">someday</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {tasks.filter((t: any) => t.status !== 'done' && t.status !== 'archived').length === 0 && (
                  <div style={{ color: '#333', fontSize: 12, letterSpacing: '0.08em' }}>
                    no active tasks. add one above or approve from reconcile.
                  </div>
                )}
              </div>
            )}

            {taskSubView === 'done' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <button onClick={copyDoneLog} style={btnStyle('#1a1a1a', copied ? '#c8b89a' : '#888')}>
                    {copied ? '✓ copied' : "copy today's log"}
                  </button>
                </div>
                {dailyLogs.length === 0 ? (
                  <div style={{ color: '#333', fontSize: 12, letterSpacing: '0.08em' }}>
                    no completed tasks yet.
                  </div>
                ) : (
                  Object.entries(
                    dailyLogs.reduce((acc: Record<string, any[]>, l: any) => {
                      if (!acc[l.log_date]) acc[l.log_date] = []
                      acc[l.log_date].push(l)
                      return acc
                    }, {})
                  ).map(([date, entries]) => (
                    <div key={date} style={{ marginBottom: 24 }}>
                      <div style={{
                        fontSize: 10, color: '#555', letterSpacing: '0.15em',
                        textTransform: 'uppercase', marginBottom: 10,
                        paddingBottom: 6, borderBottom: '1px solid #1a1a1a',
                      }}>
                        {new Date(date).toLocaleDateString('en-GB', {
                          weekday: 'long', day: 'numeric', month: 'long'
                        })}
                      </div>
                      {(entries as any[]).map((l: any) => (
                        <div key={l.id} style={{
                          display: 'flex', gap: 10, padding: '6px 0',
                          borderBottom: '1px solid #141414', alignItems: 'baseline',
                        }}>
                          <span style={{ fontSize: 13, color: '#d4cfc7', flex: 1 }}>
                            {l.task_title}
                          </span>
                          {l.project && (
                            <span style={{ fontSize: 10, color: '#c8b89a', letterSpacing: '0.08em' }}>
                              {l.project}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg: string, color: string) {
  return {
    background: bg,
    border: `1px solid ${bg === '#1a1a1a' ? '#2a2a2a' : bg}`,
    color,
    padding: '5px 14px',
    fontSize: 10,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    borderRadius: 3,
    fontFamily: '"IBM Plex Mono", monospace',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  }
}
