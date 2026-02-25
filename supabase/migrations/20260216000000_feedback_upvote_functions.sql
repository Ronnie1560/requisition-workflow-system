-- =====================================================
-- Add RPC functions for feedback upvote management
-- =====================================================
-- These functions atomically increment/decrement the upvotes counter
-- on platform_feedback when users vote/unvote.
-- Uses SECURITY DEFINER so the counter update bypasses RLS
-- (only platform admins can UPDATE platform_feedback via RLS).
-- =====================================================

CREATE OR REPLACE FUNCTION increment_feedback_upvotes(feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE platform_feedback
  SET upvotes = COALESCE(upvotes, 0) + 1,
      updated_at = NOW()
  WHERE id = feedback_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_feedback_upvotes(feedback_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE platform_feedback
  SET upvotes = GREATEST(COALESCE(upvotes, 0) - 1, 0),
      updated_at = NOW()
  WHERE id = feedback_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_feedback_upvotes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_feedback_upvotes(UUID) TO authenticated;
