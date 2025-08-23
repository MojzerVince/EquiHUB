# Testing Push Notifications for Friend Requests

Follow these steps to test the push notification system for friend requests:

## 1. Database Setup

First, make sure you've set up the push notifications database by running the SQL commands in `PUSH_NOTIFICATIONS_SETUP.md` in your Supabase dashboard.

## 2. App Setup

The push notification system is now integrated into your app with:

✅ **Automatic Token Registration**: When users open the community screen, their device automatically registers for push notifications
✅ **Friend Request Notifications**: When someone sends a friend request, the recipient gets a push notification
✅ **Notification Handling**: Tapping notifications opens the community screen and shows the notifications modal

## 3. Testing Steps

### Step 1: Test with Two Devices/Accounts

1. **Device A**: Login with one account
2. **Device B**: Login with a different account
3. Both devices should automatically register for push notifications when opening the community screen

### Step 2: Send Friend Request

1. **Device A**: Go to Community screen → Search for the user from Device B
2. **Device A**: Tap "Add Friend" button
3. **Device B**: Should receive a push notification saying "[Name] sent you a friend request"

### Step 3: Handle Notification

1. **Device B**: Tap on the notification
2. App should open to the Community screen
3. Notifications modal should show the friend request
4. User can accept or decline the request

## 4. What's Implemented

### NotificationService (`lib/notificationService.ts`)

- ✅ Device registration for push notifications
- ✅ Push token storage in database
- ✅ Send friend request notifications
- ✅ Handle notification responses
- ✅ Automatic project ID detection

### Community Screen (`app/(tabs)/community.tsx`)

- ✅ Auto-register for notifications on component mount
- ✅ Send push notification when friend request is sent
- ✅ Listen for incoming notifications and refresh data
- ✅ Handle notification taps to open notification modal

### App Layout (`app/_layout.tsx`)

- ✅ Global notification handling
- ✅ Navigation to community screen when friend request notification is tapped

### Database Tables

- ✅ `user_push_tokens`: Store device push tokens
- ✅ `notification_history`: Track sent notifications (optional)

## 5. Features

### Real-time Notifications

- Users get instant notifications when someone sends them a friend request
- Notifications work even when the app is closed or in background
- Tapping notifications opens the app and navigates to the right screen

### Security

- Push tokens are securely stored with RLS policies
- Only authenticated users can register tokens
- Notifications include sender information for context

### Multi-device Support

- Users with multiple devices will receive notifications on all devices
- Old tokens are updated when users switch devices

## 6. Troubleshooting

### No Notifications Received

1. **Check device**: Must test on physical device (push notifications don't work in simulator)
2. **Check permissions**: User must allow notifications when prompted
3. **Check database**: Verify push token was saved to `user_push_tokens` table
4. **Check console**: Look for error messages during token registration

### Notifications Not Opening App

1. **Check app state**: App must be installed and not deleted
2. **Check notification data**: Verify notification includes correct type and data
3. **Check navigation**: Verify global notification handler in `_layout.tsx`

### Token Registration Fails

1. **Check project ID**: Verify Expo project configuration
2. **Check network**: Ensure device has internet connection
3. **Check Supabase**: Verify database connection and table exists

## 7. Development Notes

### Project ID

The system automatically detects your Expo project ID from `Constants.expoConfig`. If you encounter issues, you can manually set it in `notificationService.ts`.

### Expo Push Service

The app uses Expo's push notification service which handles the actual delivery of notifications to devices.

### Testing Environment

- **Development**: Works with Expo Development Client
- **Production**: Works with built apps (EAS Build, App Store, Play Store)

## 8. Next Steps

Consider implementing these additional features:

- **Post Notifications**: Notify users when friends like or comment on their posts
- **Badge Notifications**: Notify users when they earn new badges
- **Riding Notifications**: Notify users when friends start riding sessions
- **Group Notifications**: Notify users about group activities or events

The notification system is designed to be extensible, so adding new notification types is straightforward using the existing infrastructure.
