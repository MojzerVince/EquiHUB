# Google OAuth Integration Setup

This guide explains how to set up Google OAuth integration with Supabase database storage for EquiHUB.

## Database Setup

1. **Run the migration script to add Google OAuth support:**

   ```sql
   -- Execute in Supabase SQL Editor
   \i migrations/add_google_oauth_support.sql
   ```

2. **Verify the migration:**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'google_id';
   ```

## Server Environment Variables

Update your server environment files with the required credentials:

### Development (.env)

```properties
# Supabase Configuration
SUPABASE_URL=https://grdsqxwghajehneksxik.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Google OAuth Configuration
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### Production (.env.production)

```properties
# Update with production values
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
```

## Google Console Configuration

1. **Create OAuth 2.0 Client IDs in Google Console:**

   - Web Client ID (for server-side token exchange)
   - Android Client ID (for native app)

2. **Configure Authorized Redirect URIs:**

   ```
   # For development
   http://localhost:8081/auth/callback

   # For production web
   https://your-domain.com/auth/callback

   # For mobile app
   com.mojzi1969.EquiHUB://oauth/callback
   ```

## How It Works

1. **User Authentication Flow:**

   - User clicks "Sign in with Google"
   - App redirects to Google OAuth
   - Google returns authorization code
   - Server exchanges code for user info using client secret
   - Server creates/updates user in Supabase profiles table
   - Server returns Supabase user data to app
   - App stores session data locally

2. **Database Operations:**

   - New users: Creates profile with Google ID
   - Returning users: Updates profile with latest Google info
   - Session management: Uses AsyncStorage for OAuth sessions

3. **Security Features:**
   - Client secret stored server-side only
   - Supabase RLS policies protect user data
   - Session validation and refresh

## Files Modified

- `lib/userService.ts` - User authentication service
- `lib/authAPI.ts` - Google OAuth integration
- `contexts/AuthContext.tsx` - Session management
- `server/secure-api-proxy.ts` - Server-side OAuth handling

## Testing

1. **Test Google Sign In:**

   - Click "Login with Google" button
   - Complete OAuth flow
   - Verify user appears in Supabase profiles table
   - Check console logs for session creation

2. **Test Session Persistence:**

   - Sign in with Google
   - Close and reopen app
   - Verify user remains signed in

3. **Test Sign Out:**
   - Sign out from app
   - Verify session data is cleared
   - Verify user is redirected to auth screen

## Troubleshooting

**Common Issues:**

- Redirect URI mismatch: Check Google Console configuration
- Client secret error: Verify server environment variables
- Database permission denied: Check Supabase RLS policies
- Session not persisting: Check AsyncStorage implementation

**Debug Logs:**

- Server logs show OAuth token exchange
- App logs show session creation/restoration
- Supabase logs show database operations
