-- Migration to add rejection_reason column to requisitions table
-- This column stores the reason when a requisition is rejected

-- Add the rejection_reason column
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN requisitions.rejection_reason IS 'Stores the reason for rejection when a requisition is rejected';

-- Create an index for queries that filter by rejected status
CREATE INDEX IF NOT EXISTS idx_requisitions_rejected 
ON requisitions (status) 
WHERE status = 'rejected';
