# Storage Setup - Permission Error Solutions

If you're getting the error `ERROR: 42501: must be owner of relation objects`, here are several ways to fix it:

## Option 1: Manual Setup via Supabase Dashboard (Recommended)

This is the easiest and most reliable method:

### Step 1: Create Buckets

1. Go to your Supabase dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **"New bucket"** for each of these:

#### Bucket 1: badges

- **Name**: `badges`
- **Public bucket**: ✅ Yes
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Bucket 2: challenges

- **Name**: `challenges`
- **Public bucket**: ✅ Yes
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Bucket 3: stables

- **Name**: `stables`
- **Public bucket**: ✅ Yes
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Bucket 4: profiles

- **Name**: `profiles`
- **Public bucket**: ❌ No
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Bucket 5: horses

- **Name**: `horses`
- **Public bucket**: ✅ Yes
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Bucket 6: images

- **Name**: `images`
- **Public bucket**: ✅ Yes
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/gif`

### Step 2: Set Up Policies

For each bucket, click on it and go to **"Policies"** tab:

#### For Public Buckets (badges, challenges, stables, horses, images):

1. **INSERT Policy**:

   - Name: `Allow authenticated uploads`
   - Allowed operation: INSERT
   - Target roles: authenticated
   - Policy definition: `true`

2. **SELECT Policy**:
   - Name: `Allow public viewing`
   - Allowed operation: SELECT
   - Target roles: public
   - Policy definition: `true`

#### For Private Bucket (profiles):

1. **INSERT Policy**:

   - Name: `Users can upload own profile`
   - Allowed operation: INSERT
   - Target roles: authenticated
   - Policy definition: `auth.uid()::text = (storage.foldername(name))[1]`

2. **SELECT Policy**:
   - Name: `Users can view own profile`
   - Allowed operation: SELECT
   - Target roles: authenticated
   - Policy definition: `auth.uid()::text = (storage.foldername(name))[1]`

## Option 2: Use Simplified SQL Script

Try running the `create_storage_buckets_simple.sql` file instead. This version has fewer permissions requirements.

## Option 3: Run as Database Owner

If you have access to the database owner credentials:

1. In Supabase dashboard, go to **Settings** → **Database**
2. Look for **Connection pooling** or **Direct connection**
3. Use the connection details with a database admin tool
4. Run the original SQL script with elevated permissions

## Option 4: Enable RLS and Run Script Separately

Sometimes the issue is with RLS not being enabled:

```sql
-- First enable RLS on storage.objects (run this first)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Then run the simplified script
```

## Option 5: Supabase CLI Method

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push
```

## Option 6: Contact Support or Use Service Role

If none of the above work:

1. **Check your project settings**: Some Supabase projects have restricted permissions
2. **Use service role key**: In your Supabase settings, use the service role key (never expose this in client code)
3. **Contact Supabase support**: They can help with permission issues

## Verification

After setting up storage, test it works:

```typescript
// Test in your app
import { supabase } from "../lib/supabase";

const testStorageSetup = async () => {
  const { data, error } = await supabase.storage.listBuckets();
  console.log("Buckets:", data);
  console.log("Error:", error);
};
```

You should see all 6 buckets listed.

## Common Issues and Solutions

### Issue: "Bucket already exists"

- **Solution**: Skip bucket creation or use `ON CONFLICT DO NOTHING`

### Issue: "Policy already exists"

- **Solution**: Drop existing policies first or use `CREATE POLICY IF NOT EXISTS`

### Issue: "RLS not enabled"

- **Solution**: Enable RLS first: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`

### Issue: "Invalid bucket configuration"

- **Solution**: Check MIME types and file size limits match your needs

## Recommended Approach

**Start with Option 1 (Manual Dashboard Setup)** - it's the most reliable and doesn't require dealing with SQL permissions.

Once you confirm storage is working, you can always export the configuration or recreate it programmatically later.
