# Stable/Ranch Functionality Setup

## Current Status

The stable/ranch creation and search functionality is **implemented in code** but requires **database tables** to work properly.

## What's Working

- ✅ SimpleStableSelection UI component
- ✅ SimpleStableAPI with proper create/search logic
- ✅ Profile screen integration with stable selection
- ✅ Error handling and user feedback

## What's Missing

- ❌ Database tables (`stables` and `stable_members`)
- ❌ Database functions and triggers for member count management

## How to Fix

### Step 1: Run Database Migrations

Execute these SQL files in your Supabase SQL Editor in order:

1. **`migrations/add_missing_profile_columns.sql`** (if not already done)

   - Adds `stable_ranch`, `experience`, `is_pro_member` columns to profiles table

2. **`migrations/create_stables_tables.sql`** (NEW - required for stable functionality)

   - Creates `stables` table for stable/ranch information
   - Creates `stable_members` table for user-stable relationships
   - Adds proper indexes, constraints, and functions
   - **Note**: RLS is disabled for demo purposes to avoid infinite recursion

3. **IF YOU GET RECURSION ERROR**: Run `migrations/fix_rls_recursion.sql`

   - Fixes "infinite recursion detected in policy" error
   - Disables problematic Row Level Security policies

   - Creates `stables` table for stable/ranch information
   - Creates `stable_members` table for user-stable relationships
   - Adds proper indexes, constraints, and RLS policies
   - Creates functions for managing member counts

4. **`migrations/verify_stables_tables.sql`** (verification)
   - Checks that all tables and structures were created correctly

### Step 2: Test the Functionality

After running the migrations, you can:

- **Create new stables**: App will save them to the database
- **Search for stables**: App will find existing stables in the database
- **Join existing stables**: App will create proper member relationships
- **Profile display**: Will show current stable/ranch information

## Migration Files Created

- `migrations/create_stables_tables.sql` - Creates all required database structures
- `migrations/verify_stables_tables.sql` - Verifies the migration worked
- Updated `migrations/README.md` - Includes instructions for stable tables

## Code Changes Made

- ✅ Imported `SimpleStableAPI` in profile screen
- ✅ Added stable creation logic to `handleSave` function
- ✅ Added stable joining logic for existing stables
- ✅ Added proper error handling with user-friendly messages
- ✅ Added state management for stable operations
- ✅ Removed problematic RPC function calls, now uses database triggers

## Common Errors and Fixes

- **Infinite recursion error**: Run `migrations/fix_rls_recursion.sql`
- **Function not found error**: Run `migrations/remove_rpc_functions.sql`
- **Schema cache issues**: Restart Supabase database in dashboard

The functionality is now **fully implemented** and just needs the database schema to be complete!
