-- Migration: Update subscription plan limits
-- Date: 2026-01-18
-- Description: Update Professional plan to support 10 users instead of 5

-- Update existing organizations on Professional plan
UPDATE organizations
SET max_users = 10
WHERE plan = 'professional' AND max_users < 10;

-- Update the default value for future organizations (commented for reference)
-- Note: Default is set to 5 in the schema, but should be updated based on plan:
-- Free: 3 users
-- Starter: 5 users
-- Professional: 10 users
-- Enterprise: unlimited (999)

COMMENT ON COLUMN organizations.max_users IS 'Maximum users allowed. Default: Free=3, Starter=5, Professional=10, Enterprise=999';
