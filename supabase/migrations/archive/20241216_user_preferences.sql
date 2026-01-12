-- =====================================================
-- User Preferences Migration
-- Adds table for user-specific application settings
-- =====================================================

-- =====================================================
-- TABLE: user_preferences
-- Stores user-specific application preferences
-- =====================================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Theme settings
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  accent_color VARCHAR(20) DEFAULT 'blue',

  -- Notification preferences
  enable_notifications BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  requisition_updates BOOLEAN DEFAULT true,
  approval_notifications BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,

  -- Default values
  default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  default_expense_account_id UUID REFERENCES expense_accounts(id) ON DELETE SET NULL,
  items_per_page INTEGER DEFAULT 20 CHECK (items_per_page BETWEEN 10 AND 100),

  -- Display preferences
  compact_view BOOLEAN DEFAULT false,
  show_archived BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Create index for efficient user lookup
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- =====================================================
-- RLS Policies
-- =====================================================

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- Function to create default preferences for new users
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create preferences for new users
CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_preferences();

-- =====================================================
-- Create preferences for existing users
-- =====================================================
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM user_preferences WHERE user_id = users.id
);

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE user_preferences IS 'User-specific application preferences and settings';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference: light, dark, or system';
COMMENT ON COLUMN user_preferences.items_per_page IS 'Number of items to display per page in lists';
