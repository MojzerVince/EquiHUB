# EquiHUB Authentication System

This document explains the new authentication system implemented in EquiHUB.

## 🔑 Features

### ✅ Complete Authentication Flow

- **User Registration** with email and password
- **User Login** with email and password
- **Password Reset** functionality
- **Secure Session Management**
- **Automatic Profile Creation**

### ✅ Security Features

- **Row Level Security (RLS)** on all database tables
- **Email validation** and password requirements
- **Protected routes** - users can only access their own data
- **JWT token-based** authentication
- **Secure logout** functionality

### ✅ User Experience

- **Welcome screen** for new users
- **Loading states** during authentication
- **Form validation** with helpful error messages
- **Password visibility toggle**
- **Demo account** for testing

## 📱 Screens

### 1. Welcome Screen (`/`)

- **Purpose**: Landing page for unauthenticated users
- **Features**: App introduction, navigation to login/register
- **Access**: Only visible to unauthenticated users

### 2. Register Screen (`/register`)

- **Purpose**: New user account creation
- **Fields**:
  - Full Name (required, 2-50 characters)
  - Age (required, 13-120 years)
  - Email (required, valid email format)
  - Password (required, 6+ characters)
  - Confirm Password (required, must match)
  - Description (optional, 500 characters max)
- **Validation**: Real-time form validation with error messages
- **Flow**: Registration → Email verification → Login screen

### 3. Login Screen (`/login`)

- **Purpose**: Existing user authentication
- **Fields**: Email, Password
- **Features**:
  - Password visibility toggle
  - Forgot password functionality
  - Demo account quick-fill
- **Flow**: Login → Main app (tabs)

## 🗄️ Database Structure

### Users Table (Supabase Auth)

- Managed by Supabase Auth system
- Stores email, password (hashed), and metadata

### Profiles Table

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 120),
  description TEXT DEFAULT 'Equestrian enthusiast',
  experience INTEGER DEFAULT 1 CHECK (experience >= 1),
  is_pro_member BOOLEAN DEFAULT FALSE,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security Policies

- **Profiles**: Users can view all profiles but only modify their own
- **Horses**: Users can only access their own horses
- **Storage**: Users can only access their own uploaded images

## 🔧 Technical Implementation

### Authentication Context (`contexts/AuthContext.tsx`)

- Provides authentication state throughout the app
- Handles session management and user state
- Exposes methods: `signOut`, `refreshUser`

### Auth API (`lib/authAPI.ts`)

- Handles all authentication operations
- Methods:
  - `register(data)` - Create new user account
  - `login(data)` - Authenticate existing user
  - `logout()` - Sign out current user
  - `resetPassword(email)` - Send password reset email
  - `getCurrentUser()` - Get current session user

### Protected Routes (`components/ProtectedRoute.tsx`)

- Automatically redirects based on authentication state
- Unauthenticated users → Welcome screen
- Authenticated users → Main app

### Form Validation

- Real-time validation with helpful error messages
- Client-side validation for better UX
- Server-side validation for security

## 🚀 Setup Instructions

### 1. Database Setup

Run the SQL scripts in `AUTH_DATABASE_SETUP.md`:

```bash
# In Supabase SQL Editor, run:
# 1. Update profiles table structure
# 2. Create RLS policies
# 3. Create user registration trigger
# 4. Update storage policies
```

### 2. Environment Configuration

Ensure your Supabase credentials are correct in `lib/supabase.ts`:

```typescript
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";
```

### 3. Email Configuration (Optional)

In Supabase Dashboard > Authentication > Settings:

- Configure email templates
- Set up custom SMTP (for production)
- Configure redirect URLs

## 🧪 Testing

### Demo Account

- **Email**: `demo@equihub.com`
- **Password**: `demo123`
- Pre-configured for testing all features

### Test Scenarios

1. **Registration Flow**:

   - Try to register with invalid data
   - Register with valid data
   - Check email verification

2. **Login Flow**:

   - Try invalid credentials
   - Login with demo account
   - Test "Remember me" functionality

3. **Protected Routes**:

   - Try accessing `/horses` without authentication
   - Login and verify access to protected content

4. **Logout**:
   - Test logout from options screen
   - Verify redirect to welcome screen

## 🔒 Security Considerations

### Production Checklist

- [ ] Enable email confirmation in Supabase
- [ ] Configure custom SMTP for emails
- [ ] Set up proper CORS policies
- [ ] Review and tighten RLS policies
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Regular security audits

### Current Security Features

- ✅ **Password hashing** (handled by Supabase)
- ✅ **JWT tokens** for session management
- ✅ **Row Level Security** on all tables
- ✅ **Input validation** on client and server
- ✅ **HTTPS enforcement** (in production)
- ✅ **Rate limiting** (built into Supabase)

## 🐛 Troubleshooting

### Common Issues

#### "User not authenticated" errors

- Check if user session is valid
- Verify JWT token in browser dev tools
- Ensure RLS policies are correctly set

#### Registration not working

- Check email format validation
- Verify Supabase project settings
- Check for duplicate email addresses

#### Profile not created after registration

- Verify the trigger function is working
- Check Supabase function logs
- Ensure profiles table permissions

#### Storage upload failures

- Verify storage bucket exists and is public
- Check storage RLS policies
- Ensure correct file paths

### Debug Tools

- **Supabase Dashboard**: Check auth logs and database logs
- **React Native Debugger**: Monitor authentication state
- **Console Logs**: Check client-side auth flow

## 📈 Future Enhancements

### Planned Features

- [ ] **Social Login** (Google, Apple, Facebook)
- [ ] **Two-Factor Authentication** (2FA)
- [ ] **Email Verification** flow
- [ ] **Account Deletion** functionality
- [ ] **Password Change** in app
- [ ] **Profile Completion** wizard
- [ ] **Terms of Service** acceptance

### Advanced Features

- [ ] **Role-based Access Control** (Admin, Pro, Regular)
- [ ] **Organization/Club** management
- [ ] **Invitation System** for clubs
- [ ] **Session Management** (multiple devices)
- [ ] **Audit Logging** for security

## 📞 Support

If you encounter issues:

1. Check this documentation
2. Review Supabase dashboard logs
3. Check console errors in development
4. Verify database schema matches documentation

## 🎯 Quick Start Guide

1. **Start the development server**:

   ```bash
   npx expo start
   ```

2. **Test registration**:

   - Open app → "Get Started"
   - Fill registration form
   - Check Supabase dashboard for new user

3. **Test login**:

   - Use demo account or registered account
   - Verify access to protected screens

4. **Test logout**:
   - Go to Options tab
   - Tap logout
   - Verify redirect to welcome screen

That's it! Your authentication system is ready to use. 🎉
