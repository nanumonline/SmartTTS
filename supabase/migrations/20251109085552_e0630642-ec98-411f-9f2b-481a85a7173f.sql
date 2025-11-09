-- Remove email column from profiles table to prevent PII exposure
-- Email addresses should only be accessed from auth.users table for better security

-- Drop the email column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update the handle_new_user function to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, organization, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'organization', ''),
    COALESCE(new.raw_user_meta_data->>'department', '')
  );
  RETURN new;
END;
$function$;