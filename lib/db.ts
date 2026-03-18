import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { mkdirSync } from 'fs'

const DB_DIR = path.join(os.homedir(), 'Desktop', 'memory-machine-v2', 'data')
mkdirSync(DB_DIR, { recursive: true })

const DB_PATH = path.join(DB_DIR, 'tasks.db')

const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT,
    area TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    priority TEXT NOT NULL DEFAULT 'soon',
    notes TEXT,
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    done_at TEXT
  );

  CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    previous_values TEXT,
    new_values TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    task_title TEXT NOT NULL,
    project TEXT,
    log_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS proposed_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT,
    priority TEXT NOT NULL DEFAULT 'soon',
    status TEXT NOT NULL DEFAULT 'active',
    source_text TEXT,
    source_entry_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
`)

// Seed projects if empty
const projectCount = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count
if (projectCount === 0) {
  const insert = db.prepare('INSERT INTO projects (id, name, area, active) VALUES (?, ?, ?, 1)')
  const projects = [
    ['proj_1', 'Teatrino', 'commission'],
    ['proj_2', 'Epic Ireland', 'commission'],
    ['proj_3', 'Starchild', 'commission'],
    ['proj_4', 'Hushabye Lullaby', 'commission'],
    ['proj_5', 'Curious Dreamers', 'curious_dreamers'],
    ['proj_6', 'Wunderklub', 'commission'],
    ['proj_7', 'DTTM', 'creative_dev'],
    ['proj_8', 'Signal Dreams', 'creative_dev'],
    ['proj_9', 'organism', 'creative_dev'],
    ['proj_10', 'Life Admin', 'life_admin'],
  ]
  projects.forEach(p => insert.run(...p))
}

export default db
