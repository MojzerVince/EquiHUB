# Supabase Storage Setup Guide

This guide will help you set up Supabase Storage for your EquiHUB app to handle badges, challenge icons, stable images, profile pictures, and horse photos.

## ⚠️ Having Permission Issues?

If you get an error like `ERROR: 42501: must be owner of relation objects`, check the **STORAGE_SETUP_TROUBLESHOOTING.md** file for detailed solutions.

## Prerequisites

1. Supabase project already set up
2. Database migrations already applied
3. Authentication working

## Step 1: Create Storage Buckets

### Option A: Automated Setup (Recommended)

Try running the simplified SQL script first:

```sql
-- Execute the create_storage_buckets_simple.sql file in your Supabase SQL Editor
```

### Option B: Manual Setup (If SQL fails)

Go to your Supabase Dashboard → Storage → Buckets and create manually. See STORAGE_SETUP_TROUBLESHOOTING.md for detailed steps.

1. Go to Storage > Buckets in your Supabase dashboard
2. Create the following buckets with these settings:

#### Badges Bucket

- **Name**: `badges`
- **Public**: Yes
- **File size limit**: 2MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Challenges Bucket

- **Name**: `challenges`
- **Public**: Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`
- **Purpose**: Global challenge icons and badges for cross-stable competitions

#### Global Challenges Bucket

- **Name**: `global-challenges`
- **Public**: Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`
- **Purpose**: Icons and images for global stable competitions where all stables compete against each other

#### Stables Bucket

- **Name**: `stables`
- **Public**: Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Profiles Bucket

- **Name**: `profiles`
- **Public**: No (RLS policies control access)
- **File size limit**: 5MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Horses Bucket

- **Name**: `horses`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp`

#### Images Bucket (General)

- **Name**: `images`
- **Public**: Yes
- **File size limit**: 10MB
- **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/gif`

## Step 2: Verify Storage Policies

The SQL script should have created Row Level Security (RLS) policies. Verify these exist:

### Badges Bucket Policies

- `badges_insert_policy`: Authenticated users can upload badges
- `badges_select_policy`: Anyone can view badges
- `badges_update_policy`: Only uploader can update badges
- `badges_delete_policy`: Only uploader can delete badges

### Challenges Bucket Policies

- Similar structure for challenge icons

### Stables Bucket Policies

- `stables_insert_policy`: Stable members can upload stable images
- `stables_select_policy`: Anyone can view stable images
- `stables_update_policy`: Only stable members can update
- `stables_delete_policy`: Only stable members can delete

### Profiles Bucket Policies

- `profiles_insert_policy`: Users can upload their own profile images
- `profiles_select_policy`: Users can view their own profile images
- `profiles_update_policy`: Users can update their own profile images
- `profiles_delete_policy`: Users can delete their own profile images

### Horses & Images Buckets

- Similar policies with appropriate access controls

## Step 3: Install Required Dependencies

Install the necessary packages for image uploading:

```bash
npx expo install expo-image-picker
```

## Step 4: Test the Storage Service

Create a simple test to verify everything is working:

```typescript
// Test upload function
import { StorageService } from "../lib/storageService";

const testUpload = async () => {
  try {
    // Test with a simple file
    const testFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const result = await StorageService.uploadImage(
      testFile,
      "images",
      "test",
      "test.jpg"
    );
    console.log("Upload result:", result);
  } catch (error) {
    console.error("Upload failed:", error);
  }
};
```

## Step 5: Usage Examples

### Upload Global Challenge Icon

```typescript
const uploadGlobalChallengeIcon = async (file: File, challengeId: string) => {
  const result = await StorageService.uploadImage(
    file,
    "global-challenges",
    challengeId,
    "challenge-icon.jpg"
  );
  if (result.success) {
    console.log("Global challenge icon uploaded:", result.url);
  }
};
```

### Upload Badge Icon

```typescript
import { StorageService } from "../lib/storageService";

const uploadBadge = async (file: File, fileName: string) => {
  const result = await StorageService.uploadBadgeIcon(file, fileName);
  if (result.success) {
    console.log("Badge uploaded:", result.url);
  }
};
```

### Upload Profile Image

```typescript
const uploadProfile = async (file: File, userId: string) => {
  const result = await StorageService.uploadProfileImage(file, userId);
  if (result.success) {
    console.log("Profile image uploaded:", result.url);
  }
};
```

### Upload Stable Icon

```typescript
const uploadStableIcon = async (file: File, stableId: string) => {
  const result = await StorageService.uploadStableIcon(
    file,
    stableId,
    "stable-icon.jpg"
  );
  if (result.success) {
    console.log("Stable icon uploaded:", result.url);
  }
};
```

## Step 6: Using the Upload Component

Add the ImageUploadComponent to your screens:

```typescript
import ImageUploadComponent from "../components/ImageUploadComponent";

// In your component
<ImageUploadComponent
  uploadType="global-challenge"
  challengeId={currentChallenge?.id}
  onUploadComplete={(result) => {
    if (result.success) {
      console.log("Global challenge icon uploaded:", result.url);
      // Update your state with the new image URL
    }
  }}
  showPreview={true}
  maxSize={5}
/>;
```

### Upload Types Available

- `'badge'` - For achievement badges
- `'challenge'` - For stable challenge icons
- `'global-challenge'` - For global stable competition icons
- `'stable'` - For stable profile images (requires stableId)
- `'profile'` - For user profile pictures (requires userId)
- `'horse'` - For horse photos
- `'general'` - For any other images

## Step 7: Error Handling

The StorageService includes comprehensive error handling:

- File size validation
- MIME type validation
- Automatic file compression
- Descriptive error messages

Common errors and solutions:

1. **"Bucket not found"** - Make sure you've created the storage buckets
2. **"RLS policy violation"** - Check that your RLS policies are set up correctly
3. **"File too large"** - Reduce file size or increase bucket limits
4. **"Invalid MIME type"** - Use supported image formats (JPEG, PNG, WebP)

## Step 8: Production Considerations

1. **CDN Setup**: Supabase automatically provides CDN for your storage
2. **Backup**: Consider setting up automatic backups for critical images
3. **Monitoring**: Monitor storage usage in your Supabase dashboard
4. **Optimization**: Images are automatically optimized by the StorageService

## Troubleshooting

### Common Issues

1. **Images not loading**: Check bucket policies and make sure they're public if needed
2. **Upload fails**: Verify authentication and file format
3. **RLS errors**: Ensure user is authenticated and has proper permissions

### Debug Steps

1. Check Supabase logs in the dashboard
2. Verify bucket creation and policies
3. Test with small files first
4. Check network connectivity

## Security Notes

- Profile images are private by default (RLS controlled)
- Public buckets (badges, challenges, stables, horses) are accessible to everyone
- File uploads are validated for type and size
- User authentication is required for all uploads

## Storage Limits

- **Free plan**: 1GB storage
- **Pro plan**: 100GB storage included
- **Additional storage**: $0.021 per GB per month

Monitor your usage in the Supabase dashboard under Storage > Settings.
