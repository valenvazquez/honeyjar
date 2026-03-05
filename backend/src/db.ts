import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.join(
  process.env.DB_DIR ?? "data",
  "honeyjar.sqlite"
);

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reporters (
      slug          TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      outlet        TEXT NOT NULL,
      title         TEXT NOT NULL DEFAULT '',
      email         TEXT,
      email_confidence TEXT DEFAULT 'none',
      linkedin_url  TEXT,
      twitter_handle TEXT,
      geography     TEXT,
      article_count INTEGER DEFAULT 0,
      last_article_date TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      brief_text      TEXT,
      outlet_types    TEXT DEFAULT '[]',
      geography       TEXT DEFAULT '[]',
      prioritized_pubs TEXT,
      competitor_context TEXT,
      messages        TEXT DEFAULT '[]',
      last_results    TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id              TEXT PRIMARY KEY,
      author_name     TEXT NOT NULL,
      author_slug     TEXT NOT NULL,
      title           TEXT NOT NULL,
      outlet          TEXT NOT NULL,
      outlet_normalized TEXT NOT NULL,
      publish_date    TEXT,
      url             TEXT UNIQUE NOT NULL,
      summary         TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_author_slug ON articles(author_slug);
    CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
  `);
}
