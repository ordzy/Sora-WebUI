-- Supabase Database Schema for SoraWebUI
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- User Settings (themes, subtitles, preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Theme Settings
  theme_id TEXT DEFAULT 'white',
  accent_color TEXT,
  
  -- Subtitle Settings
  sub_size TEXT DEFAULT '100%',
  sub_color TEXT DEFAULT '#ffffff',
  sub_bg_opacity TEXT DEFAULT '0.5',
  sub_outline TEXT DEFAULT 'none',
  
  -- App Behavior
  auto_activate BOOLEAN DEFAULT true,
  auto_refetch_modules BOOLEAN DEFAULT true,
  
  -- Proxy Settings
  cors_proxy TEXT,
  use_custom_proxy BOOLEAN DEFAULT false,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one settings row per user
  UNIQUE(user_id)
);

-- User Modules
CREATE TABLE IF NOT EXISTS user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate URLs per user
  UNIQUE(user_id, url)
);

-- Watch History (continue watching, progress tracking)
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  content_id TEXT NOT NULL,
  module_id TEXT,
  module_url TEXT,
  module_name TEXT,
  
  title TEXT NOT NULL,
  poster TEXT,
  
  episode_number INTEGER,
  episode_id TEXT,
  stream_url TEXT,
  headers JSONB,
  subtitles JSONB,
  
  timestamp FLOAT DEFAULT 0, -- Playback position in seconds
  duration FLOAT, -- Total duration
  
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One entry per content/episode per user
  UNIQUE(user_id, content_id, episode_number)
);

-- Hidden Continue Watching Items
CREATE TABLE IF NOT EXISTS hidden_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  content_id TEXT NOT NULL,
  episode_number INTEGER,
  
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, content_id, episode_number)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_modules_user_id ON user_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched ON watch_history(user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_hidden_items_user_id ON hidden_items(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_items ENABLE ROW LEVEL SECURITY;

-- User Settings Policies
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- User Modules Policies
CREATE POLICY "Users can view own modules"
  ON user_modules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own modules"
  ON user_modules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own modules"
  ON user_modules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own modules"
  ON user_modules FOR DELETE
  USING (auth.uid() = user_id);

-- Watch History Policies
CREATE POLICY "Users can view own watch history"
  ON watch_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watch history"
  ON watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watch history"
  ON watch_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watch history"
  ON watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- Hidden Items Policies
CREATE POLICY "Users can view own hidden items"
  ON hidden_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hidden items"
  ON hidden_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hidden items"
  ON hidden_items FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_modules_updated_at
  BEFORE UPDATE ON user_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watch_history_updated_at
  BEFORE UPDATE ON watch_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
