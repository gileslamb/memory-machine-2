import { NextResponse } from 'next/server'

// Set OLLAMA_DISTILL_MODEL=qwen3:32b for higher quality distillation
const OLLAMA_MODEL = process.env.OLLAMA_DISTILL_MODEL || 'qwen3:8b'
const OLLAMA_TIMEOUT_MS = 30000

export async function POST(req: Request) {
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `Extract only the key facts from the following as a concise bullet list. Remove all prose, filler, repetition, and meta-commentary. Return only the bullets, nothing else.

Text:
${text.trim()}`,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!ollamaRes.ok) {
      return NextResponse.json({ error: 'Ollama request failed' }, { status: 502 })
    }

    const data = await ollamaRes.json()
    const raw = data.response?.trim() ?? ''
    const distilled = raw || text.trim()
    return NextResponse.json({ distilled })
  } catch {
    return NextResponse.json({ error: 'Distillation failed' }, { status: 503 })
  }
}
