# Profile Table Migration Instructions

## Issue

The application is trying to save profile data with columns that don't exist in the database:

- `stable_ranch` - for storing stable/ranch name
- `experience` - for storing years of riding experience
- `is_pro_member` - for storing PRO membership status

## Error Message

```
ERROR  Update profile API response not OK: 400
ERROR  Error response: {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the 'stable_ranch' column of 'profiles' in the schema cache"}
```

## Solution

Run the database migration to add the missing columns to the `profiles` table.

## Steps to Fix

### 1. Open Supabase SQL Editor

1. Go to your Supabase dashboard
2. Navigate to "SQL Editor" in the left sidebar
3. Click "New Query"

### 2. Run the Migration

Copy and paste the contents of `migrations/add_missing_profile_columns.sql` into the SQL editor and execute it.

**OR** you can copy this SQL directly:

```sql
-- Migration to add missing columns to profiles table
-- Add the stable_ranch column to store stable/ranch name (if it doesn't exist)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stable_ranch TEXT NULL;

-- Add the experience column to store years of riding experience (if it doesn't exist)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;

-- Add the is_pro_member column to store membership status (if it doesn't exist)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_pro_member BOOLEAN DEFAULT FALSE;

-- Add comments to describe the columns
COMMENT ON COLUMN public.profiles.stable_ranch IS 'Name of the stable or ranch where the user rides (optional)';
COMMENT ON COLUMN public.profiles.experience IS 'Years of riding experience';
COMMENT ON COLUMN public.profiles.is_pro_member IS 'Whether the user has a PRO membership';

-- Create indexes on the new columns for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_stable_ranch
ON public.profiles (stable_ranch)
WHERE stable_ranch IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_experience
ON public.profiles (experience);

CREATE INDEX IF NOT EXISTS idx_profiles_is_pro_member
ON public.profiles (is_pro_member);
```

### 3. Verify the Migration

Copy and paste the contents of `migrations/verify_missing_profile_columns.sql` to verify the migration was successful.

### 4. Test the Application

1. Restart your Expo development server if it's running
2. Try editing and saving a profile in the app
3. The stable/ranch selector should now work without errors

## What These Columns Do

- **`stable_ranch`**: Stores the name of the stable or ranch where the user rides (optional field)
- **`experience`**: Stores the number of years of riding experience (integer, defaults to 0)
- **`is_pro_member`**: Stores whether the user has a PRO membership (boolean, defaults to FALSE)

## Notes

- The migration uses `IF NOT EXISTS` clauses, so it's safe to run multiple times
- Existing profiles will get default values for the new columns
- The new columns are properly indexed for better query performance
- All new columns have appropriate comments for documentation

## Next Steps - Stables Tables Migration

The stable/ranch creation and search functionality requires additional database tables. After running the profile columns migration above, you also need to create the stables tables:

### 1. Create Stables Tables

Run the contents of `migrations/create_stables_tables.sql` in your Supabase SQL editor:

**Important**: This creates:

- `stables` table - for storing stable/ranch information
- `stable_members` table - for user-stable relationships
- Functions and triggers for maintaining member counts
- Proper indexing and Row Level Security policies

### 2. Verify Stables Tables

After running the stables migration, verify it worked by running `migrations/verify_stables_tables.sql`

This will show you:

- Table structures
- Indexes
- Foreign key relationships
- Security policies
- Current row counts

### 3. Test Stable Creation

Once both migrations are complete, you can:

- Create new stables/ranches in the profile editor
- Search for existing stables
- Join existing stables
- All stable data will be properly saved to the database

## Troubleshooting

If you still get errors after running the migration:

1. **Infinite Recursion Error**: If you see "infinite recursion detected in policy for relation stable_members", run `migrations/fix_rls_recursion.sql` to disable problematic RLS policies
2. **Clear the schema cache**: In Supabase, go to Settings > Database and click "Restart" to clear the schema cache
3. **Check column existence**: Run the verification script to ensure columns were created
4. **Restart your app**: Sometimes the app needs to be restarted to pick up schema changes
5. **Check your Supabase credentials**: Ensure your app is connecting to the correct database
