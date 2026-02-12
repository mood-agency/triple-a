-- Add is_default field to contacts table
-- Only one contact can be marked as default per user

ALTER TABLE contacts
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Create a partial unique index to ensure at most one default contact per user
-- The index only includes rows where is_default is true and deleted_at is null
CREATE UNIQUE INDEX idx_contacts_one_default
ON contacts(user_id)
WHERE is_default = true AND deleted_at IS NULL;

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_contacts_one_default IS 'Ensures at most one default contact per user (excluding soft-deleted contacts)';
