# Persistent Login Implementation

This document explains how the persistent login functionality works in EquiHUB.

## Overview

Users will now stay logged in when they close and reopen the app, providing a seamless experience without having to re-enter credentials every time.

## How It Works

### 1. Session Storage

- **Supabase Auth**: Automatically handles JWT token storage using AsyncStorage
- **Configuration**: The Supabase client is configured with:
  - `persistSession: true` - Saves session to device storage
  - `autoRefreshToken: true` - Automatically refreshes expired tokens
  - `storage: AsyncStorage` - Uses React Native AsyncStorage for persistence

### 2. Session Management

- **SessionManager Class**: Provides utilities for session handling
  - Check session validity
  - Get session expiry information
  - Automatic session refresh
  - Store/retrieve user preferences
  - Clear session data on logout

### 3. AuthContext Integration

- **Automatic Session Restoration**: On app startup, checks for existing valid session
- **Real-time Session Monitoring**: Listens for auth state changes
- **Session Refresh**: Automatically refreshes tokens before expiry
- **Clean Logout**: Properly clears all session data when user logs out

## Features

### ✅ Automatic Login

- Users stay logged in between app sessions
- No need to re-enter credentials
- Instant access to authenticated features

### ✅ Security

- JWT tokens are securely stored in device keychain/keystore
- Automatic token refresh prevents session expiry
- Clean logout removes all session data

### ✅ User Experience

- Visual indicator on login screen about persistent sessions
- Loading states during session restoration
- Seamless transition to authenticated content

### ✅ Session Management

- Track last login time
- Store user preferences for faster loading
- Monitor session health and expiry
- Automatic cleanup on logout

## Implementation Details

### Files Modified/Created

1. **lib/supabase.ts**

   - Added AsyncStorage configuration
   - Enabled persistent sessions
   - Configured automatic token refresh

2. **lib/sessionManager.ts** (NEW)

   - Session validity checking
   - Session info retrieval
   - User preferences storage
   - Session refresh utilities

3. **contexts/AuthContext.tsx**

   - Enhanced session restoration
   - Added session management functions
   - Improved auth state handling

4. **lib/authAPI.ts**

   - Added login time tracking
   - Enhanced with session manager integration

5. **app/login.tsx**

   - Added persistence info indicator
   - Enhanced user feedback

6. **app/register.tsx**
   - Updated success message to mention persistence

## Usage

### For Users

1. **First Login**: Enter credentials as usual
2. **Subsequent Opens**: App automatically logs you in
3. **Logout**: Tap logout to sign out and clear session
4. **Security**: Session automatically expires based on JWT settings

### For Developers

```typescript
// Check if user has valid session
const isValid = await SessionManager.hasValidSession();

// Get session information
const sessionInfo = await SessionManager.getSessionInfo();

// Refresh session if needed
await SessionManager.refreshSessionIfNeeded();

// Clear all session data
await SessionManager.clearSessionData();
```

## Security Considerations

1. **Token Storage**: Uses secure device storage (Keychain on iOS, Keystore on Android)
2. **Automatic Expiry**: Tokens automatically expire based on Supabase settings
3. **Clean Logout**: All session data is properly cleared on logout
4. **Token Refresh**: Prevents session hijacking with automatic token rotation

## Configuration

The session persistence is configured in `lib/supabase.ts`:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

## Troubleshooting

### Session Not Persisting

- Check if AsyncStorage package is installed
- Verify Supabase configuration
- Check device storage permissions

### Auto-refresh Issues

- Verify network connectivity
- Check Supabase project settings
- Review JWT expiry configuration

### Performance

- Session restoration is optimized to be fast
- User preferences are cached locally
- Background token refresh doesn't block UI
