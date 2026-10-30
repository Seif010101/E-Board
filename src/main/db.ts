// SQLite connection, pragmas and versioned schema migrations (PRAGMA user_version).
// Pure Node: never imports 'electron', so tests can open ':memory:' databases.

import { DatabaseSync } from 'node:sqlite'

export type Database = DatabaseSync

interface Migration {
  version: number
  sql: string
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id             TEXT PRIMARY KEY,
        username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name   TEXT NOT NULL,
        password_hash  TEXT NOT NULL,
        totp_secret    TEXT NULL,
        totp_enabled   INTEGER NOT NULL DEFAULT 0,
        totp_last_step INTEGER NOT NULL DEFAULT 0,
        storage_mode   TEXT NOT NULL DEFAULT 'local',
        settings_json  TEXT NOT NULL DEFAULT '{}',
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE cases (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category    TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL,
        priority    TEXT NOT NULL,
        color       TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX idx_cases_user ON cases(user_id, updated_at);

      CREATE TABLE boards (
        id            TEXT PRIMARY KEY,
        case_id       TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        title         TEXT NOT NULL,
        theme         TEXT NOT NULL,
        viewport_json TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX idx_boards_case ON boards(case_id, updated_at);

      CREATE TABLE items (
        id         TEXT PRIMARY KEY,
        board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        type       TEXT NOT NULL,
        x          REAL NOT NULL,
        y          REAL NOT NULL,
        w          REAL NOT NULL,
        h          REAL NOT NULL,
        z          INTEGER NOT NULL,
        rotation   REAL NOT NULL,
        locked     INTEGER NOT NULL,
        data_json  TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX idx_items_board ON items(board_id);

      CREATE TABLE links (
        id         TEXT PRIMARY KEY,
        board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        from_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        to_id      TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL,
        label      TEXT NOT NULL DEFAULT '',
        color      TEXT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX idx_links_board ON links(board_id);
      CREATE INDEX idx_links_from ON links(from_id);
      CREATE INDEX idx_links_to ON links(to_id);

      CREATE TABLE media (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mime       TEXT NOT NULL,
        size       INTEGER NOT NULL,
        width      INTEGER NOT NULL,
        height     INTEGER NOT NULL,
        sha256     TEXT NOT NULL,
        bytes      BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (user_id, sha256)
      ) STRICT;
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE links ADD COLUMN via_json TEXT NOT NULL DEFAULT '[]';
    `
  }
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

const userVersion = (db: Database): number => Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0)

function migrate(db: Database): void {
  const current = userVersion(db)
  if (current > SCHEMA_VERSION) {
    throw new Error(`Database schema v${current} is newer than this app supports (v${SCHEMA_VERSION})`)
  }
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    if (!Number.isInteger(m.version)) throw new Error('Invalid migration version')
    transaction(db, () => {
      db.exec(m.sql)
      // PRAGMA cannot take bound parameters; the value is a code constant, never input.
      db.exec(`PRAGMA user_version = ${m.version}`)
    })
  }
}

/** Opens (creating if needed) and migrates the database. Accepts a file path or ':memory:'. */
export function openDatabase(path: string): Database {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true })
  try {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec('PRAGMA busy_timeout = 5000')
    // Deleted evidence is overwritten instead of lingering in free pages.
    db.exec('PRAGMA secure_delete = ON')
    migrate(db)
    return db
  } catch (err) {
    db.close()
    throw err
  }
}

/** Runs `fn` inside BEGIN IMMEDIATE … COMMIT, rolling back on any error. `fn` must be synchronous. */
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw err
  }
}
