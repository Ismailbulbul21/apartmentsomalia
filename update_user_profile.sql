-- Function to update user profile bypassing RLS
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_full_name TEXT,
  p_whatsapp_number TEXT,
  p_avatar_url TEXT
) RETURNS VOID AS $$
BEGIN
  -- Update the profile for the authenticated user
  UPDATE public.profiles
  SET 
    full_name = p_full_name,
    whatsapp_number = p_whatsapp_number,
    avatar_url = p_avatar_url,
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;

-- Comment to explain the function
COMMENT ON FUNCTION public.update_user_profile IS 'Updates a user profile with the provided information. This function uses SECURITY DEFINER to bypass RLS.'; 