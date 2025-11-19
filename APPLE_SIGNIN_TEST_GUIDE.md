# Apple Sign-In Quick Test Guide

## ✅ Implementation Complete!

Apple Sign-In has been successfully implemented in your EquiHUB app. Here's what was done:

### Files Modified:

1. ✅ `/app/register.tsx` - Now uses `OAuthButtons` component (includes Apple Sign-In)
2. ✅ `/app/login.tsx` - Already using `OAuthButtons` component
3. ✅ `/app/register-simple.tsx` - Already using `OAuthButtons` component
4. ✅ `/app.config.js` - Added `expo-apple-authentication` plugin
5. ✅ `/components/OAuthButtons.tsx` - Apple button already implemented
6. ✅ `/lib/oauthService.ts` - Apple Sign-In logic already implemented

## 🎯 Where Apple Sign-In Appears

Apple Sign-In button will appear on:

- **Login Screen** (`/login`) - iOS only
- **Register Screen** (`/register`) - iOS only
- **Register Simple Screen** (`/register-simple`) - iOS only

The button is automatically hidden on Android devices.

## 🔧 Before You Can Test

You need to complete the configuration steps in `APPLE_SIGNIN_SETUP.md`:

1. **Apple Developer Portal** (15-20 minutes)

   - Enable Sign In with Apple capability
   - Create Services ID
   - Create and download authentication key

2. **Supabase Dashboard** (5 minutes)

   - Configure Apple as OAuth provider
   - Add Services ID, Team ID, Key ID, and Secret Key

3. **Rebuild App**
   ```bash
   npx expo run:ios
   # or
   eas build --platform ios --profile development
   ```

## 🧪 Quick Test Checklist

Once configuration is complete:

### Prerequisites

- [ ] Real iOS device (Apple Sign-In doesn't work well on simulators)
- [ ] Signed in to iCloud on the device
- [ ] iOS 13 or later
- [ ] App rebuilt after configuration changes

### Test Steps

1. **Launch the app**

   ```bash
   npx expo start
   # Press 'i' for iOS
   ```

2. **Navigate to Login or Register screen**

3. **Look for the Apple button**

   - Should say "Continue with Apple" (login) or "Sign up with Apple" (register)
   - Black background with Apple logo
   - Should be visible on iOS only

4. **Tap the Apple button**

   - Apple authentication sheet should appear
   - Options to use Face ID/Touch ID or password

5. **Authenticate with Apple**

   - Choose whether to share your email or hide it
   - Choose whether to share your name

6. **Expected Results:**

   **For New Users (First Time):**

   - ✅ Apple authentication completes
   - ✅ App checks for existing profile
   - ✅ No profile found
   - ✅ Redirects to profile completion screen (`/register-complex-backup`)
   - ✅ User completes profile
   - ✅ Navigates to app

   **For Existing Users:**

   - ✅ Apple authentication completes
   - ✅ App finds existing profile
   - ✅ Logs user in
   - ✅ Navigates to app tabs

## 🐛 Common Issues & Solutions

### Button Not Showing

**Problem:** Apple button doesn't appear
**Solution:**

- Check that you're on iOS (button is hidden on Android)
- Verify plugin is added to `app.config.js`
- Rebuild the app

### "Not Available" Error

**Problem:** "Apple Sign-In is not available on this device"
**Solution:**

- Use a real iOS device (not simulator)
- Make sure device is iOS 13+
- Ensure you're signed in to iCloud

### Authentication Fails

**Problem:** Sign-in starts but fails
**Solution:**

- Verify Apple Developer Portal configuration
- Check Supabase Apple provider settings
- Ensure bundle identifier matches: `com.mojzi1969.EquiHUB`
- Verify the `.p8` key is correct in Supabase

### "No identity token received"

**Problem:** Token exchange fails
**Solution:**

- Rebuild app after enabling Sign In with Apple capability
- Check that bundle identifier is correct everywhere
- Verify provisioning profile includes Sign In with Apple

## 📱 User Experience Flow

### Sign Up Flow

```
User taps "Sign up with Apple"
    ↓
Apple authentication sheet appears
    ↓
User authenticates with Face ID/Password
    ↓
User chooses email sharing preference
    ↓
App receives Apple credentials
    ↓
App checks Supabase for existing profile
    ↓
┌─────────────────┬─────────────────┐
│  Profile Exists │  No Profile     │
├─────────────────┼─────────────────┤
│  Log in user    │  Show profile   │
│  Navigate to    │  completion     │
│  app tabs       │  screen         │
└─────────────────┴─────────────────┘
```

### Login Flow

```
User taps "Continue with Apple"
    ↓
Apple authentication sheet appears
    ↓
User authenticates with Face ID/Password
    ↓
App receives Apple credentials
    ↓
App logs in user
    ↓
Navigate to app tabs
```

## 🔐 Security Features

Your implementation includes:

- ✅ Nonce generation (random string)
- ✅ SHA-256 hashing of nonce
- ✅ Token validation
- ✅ Supabase session management
- ✅ Automatic token refresh

## 📊 What Data You Receive

From Apple Sign-In:

- **Always:**

  - User ID (unique Apple identifier)
  - Authentication token

- **Optional (User Choice):**

  - Email address (real or private relay)
  - Full name (given name + family name)

- **Note:**
  - Full name only provided on FIRST sign-in
  - Apple can provide private relay email if user chooses to hide real email

## 🎉 After Successful Test

Once you've successfully tested Apple Sign-In:

1. **Test edge cases:**

   - Try hiding email
   - Try with different Apple IDs
   - Test existing user flow
   - Test new user flow

2. **Monitor logs:**

   - Check console for Apple-related logs
   - Verify session creation in Supabase dashboard
   - Check user profiles are created correctly

3. **Prepare for production:**
   - Test on TestFlight
   - Verify production Supabase configuration
   - Ensure production bundle ID is configured

## 📝 Notes

- Apple requires apps with social login to also offer Apple Sign-In
- Button appearance and wording must follow Apple's guidelines
- Private email relay addresses are permanent (don't change)
- You cannot test full flow on simulator without extra setup

## 🆘 Need Help?

If you encounter issues:

1. Check `APPLE_SIGNIN_SETUP.md` for detailed configuration steps
2. Review console logs for error messages
3. Verify all configuration matches between:
   - Apple Developer Portal
   - Supabase Dashboard
   - Your app's bundle identifier
   - app.config.js

## ✨ Features

Your Apple Sign-In implementation supports:

- ✅ iOS native authentication
- ✅ Face ID / Touch ID integration
- ✅ Email hiding (private relay)
- ✅ Seamless login/signup
- ✅ New user profile completion
- ✅ Existing user quick login
- ✅ Automatic session management
