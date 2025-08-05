-- Update the trigger function to handle riding experience from registration form
-- Run this in your Supabase SQL Editor to update the user profile creation trigger

-- Update the trigger function to include riding_experience
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, age, description, experience, is_pro_member)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'age')::INTEGER, 18),
    COALESCE(NEW.raw_user_meta_data->>'description', 'Equestrian enthusiast'),
    COALESCE((NEW.raw_user_meta_data->>'riding_experience')::INTEGER, 0),
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Verify the function was updated
SELECT 
  routine_name, 
  routine_type,
  specific_name
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';
