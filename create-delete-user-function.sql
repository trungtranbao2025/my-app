-- Function to delete a user from auth.users table
-- This requires admin/service role privileges
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete user from auth.users
  -- Note: This will cascade delete to profiles due to foreign key
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Grant execute permission to authenticated users (optional, adjust as needed)
-- For security, you may want to restrict this to only admins
GRANT EXECUTE ON FUNCTION delete_user(UUID) TO authenticated;

-- Alternative: Grant only to service_role
-- GRANT EXECUTE ON FUNCTION delete_user(UUID) TO service_role;

COMMENT ON FUNCTION delete_user IS 'Deletes a user from auth.users table. Requires admin privileges.';
