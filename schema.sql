CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_key TEXT,
  child_name TEXT,
  age TEXT,
  created_date TEXT,
  memo TEXT,
  child_comment TEXT,
  tags_json TEXT,
  favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_updated_at ON artworks (updated_at DESC);
