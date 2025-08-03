# Supabase Storage Setup Guide

## Create Storage Bucket

The image upload error usually means the storage bucket doesn't exist. Follow these steps:

### 1. Go to Supabase Dashboard

1. Open your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**

### 2. Create the Bucket

1. **Name**: `profile-images`
2. **Public bucket**: ✅ **Check this box** (important!)
3. **File size limit**: Leave default or set to 50MB
4. Click **Create bucket**

### 3. Set Bucket Policies

Go to **Storage** > **Policies** and create these policies:

#### Policy 1: Allow Public Read

```sql
-- Allow anyone to view images
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');
```

#### Policy 2: Allow Authenticated Upload

```sql
-- Allow anyone to upload images (you can restrict this later)
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-images');
```

#### Policy 3: Allow Update

```sql
-- Allow anyone to update images
CREATE POLICY "Anyone can update their own avatar." ON storage.objects FOR UPDATE USING (bucket_id = 'profile-images');
```

### 4. Alternative: Quick Setup via SQL

You can also run this in the SQL Editor:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

-- Create policies
CREATE POLICY "Allow public access" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-images');
CREATE POLICY "Allow public update" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-images');
```

## Troubleshooting Network Issues

### Common Causes:

1. **Storage bucket doesn't exist** → Follow steps above
2. **Bucket is private** → Make sure "Public bucket" is checked
3. **No upload policy** → Add the policies above
4. **Network connectivity** → Check internet connection
5. **CORS issues** → Usually auto-handled for mobile apps

### Test the Setup:

1. Run your app
2. Try to upload an image
3. Check the console logs for detailed error messages
4. Check your Supabase Storage dashboard to see if the file appears

### Still Having Issues?

- Check Supabase project status
- Verify your API keys are correct
- Try uploading a file manually through the Supabase dashboard
- Check the Supabase logs in your dashboard

## Expected File Structure

After successful upload, you should see:

```
profile-images/
  └── 550e8400-e29b-41d4-a716-446655440000/
      └── profile.jpg
```
