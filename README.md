# Memory Machine v2

Append-only context logger. Zero API calls. Weekly synthesis via claude.ai subscription.

## Setup

```bash
cd memory-machine-v2
npm install
npm run dev
```

Open http://localhost:3000

## How it works

**Daily:** Type a note → press Enter → appended to log. That's it.

**Weekly:** Go to Export tab → Copy All → paste into claude.ai → get refreshed STABLE back → paste into Stable tab → clear log.

## Data

Stored in browser localStorage. To back up, use the Export tab to copy your full context pack, or manually copy the stable doc.

## Zero cost

- No API calls
- No synthesis on entry
- No background processes
- Uses your claude.ai subscription for weekly synthesis only
