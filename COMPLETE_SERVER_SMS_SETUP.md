# Complete Server SMS Setup Guide

## Overview

This guide will help you set up the complete server-side SMS emergency alert system for EquiHub, replacing device-based SMS with reliable server-side SMS via Supabase Edge Functions and Twilio.

## Prerequisites

- Supabase project with database access
- Twilio account for SMS services
- Node.js/npm for deploying Edge Functions

## Step 1: Database Setup

Run the database setup SQL in your Supabase SQL editor:

```sql
-- Execute: EMERGENCY_SMS_DATABASE_SETUP.sql
-- This creates:
-- - emergency_sms_log table for SMS tracking
-- - sms_delivery_status table for delivery tracking
-- - emergency_contacts table enhancements
-- - RLS policies for security
```

## Step 2: Twilio Setup

1. **Create Twilio Account**:

   - Go to https://www.twilio.com/
   - Sign up for an account
   - Verify your phone number

2. **Get Twilio Credentials**:

   - Account SID (starts with AC...)
   - Auth Token (sensitive - keep secure)
   - Phone Number (your Twilio number)

3. **Configure Twilio Settings**:
   - Enable SMS capabilities
   - Set up webhook URLs (optional)
   - Configure messaging service (optional)

## Step 3: Supabase Edge Functions Deployment

1. **Install Supabase CLI**:

   ```bash
   npm install -g @supabase/cli
   ```

2. **Login to Supabase**:

   ```bash
   supabase login
   ```

3. **Deploy Edge Functions**:

   ```bash
   # Navigate to your project directory
   cd c:\Users\User\Desktop\EquiHub\EquiHUB

   # Deploy the SMS function
   supabase functions deploy send-emergency-sms --project-ref YOUR_PROJECT_REF

   # Deploy the status function
   supabase functions deploy get-sms-status --project-ref YOUR_PROJECT_REF
   ```

## Step 4: Environment Variables

Set these secrets in your Supabase project:

```bash
# Set Twilio credentials as Supabase secrets
supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_PHONE_NUMBER=your_twilio_number
```

Or use the Supabase dashboard:

1. Go to Project Settings > Edge Functions
2. Add environment variables:
   - `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
   - `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
   - `TWILIO_PHONE_NUMBER`: Your Twilio phone number (+1234567890)

## Step 5: Test the Setup

### 5.1 Basic Database Test

```sql
-- Test emergency contacts
SELECT * FROM emergency_contacts WHERE user_id = 'your-user-id';

-- Test SMS log table
SELECT * FROM emergency_sms_log ORDER BY created_at DESC LIMIT 5;
```

### 5.2 Edge Function Test

```bash
# Test the Edge Function directly
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/send-emergency-sms' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "your-user-id",
    "alertType": "test",
    "message": "Test SMS from EquiHub server",
    "location": {"latitude": 40.7128, "longitude": -74.0060}
  }'
```

### 5.3 App Integration Test

1. Open EquiHub app
2. Go to Map screen
3. Tap emergency notification button
4. Tap "📱 Test Server SMS"
5. Choose "Quick Test" or "Full Test Suite"
6. Check console logs for results

### 5.4 Validate Complete Setup

1. In the app, tap "✅ Validate SMS Setup"
2. This will check:
   - Emergency contacts configured
   - Edge Functions accessible
   - Database permissions correct
   - Twilio integration working

## Step 6: Configure Emergency Contacts

Users need to set up their emergency contacts:

1. **Using the App**:

   - Go to Profile screen
   - Tap "Emergency Contacts"
   - Add contacts with name and phone number
   - Test contact SMS delivery

2. **Direct Database Insert** (for testing):
   ```sql
   INSERT INTO emergency_contacts (user_id, name, phone_number, relationship, is_primary)
   VALUES (
     'user-id-here',
     'Emergency Contact',
     '+1234567890',
     'family',
     true
   );
   ```

## Step 7: Fall Detection Integration

The fall detection system is already integrated:

1. **Automatic Integration**: Fall detection now uses server SMS by default
2. **Fallback Support**: If server SMS fails, falls back to device SMS
3. **Configurable**: Can be adjusted in `FallDetectionAPI.ts`

## Testing Checklist

- [ ] Database tables created successfully
- [ ] Twilio account configured and active
- [ ] Edge Functions deployed without errors
- [ ] Environment variables set in Supabase
- [ ] Emergency contacts added for test user
- [ ] Quick SMS test passes
- [ ] Full SMS test suite passes
- [ ] SMS setup validation passes
- [ ] Fall detection triggers server SMS
- [ ] Fallback to device SMS works when server fails

## Troubleshooting

### Common Issues

1. **Edge Function Deployment Fails**:

   - Check Supabase CLI is latest version
   - Verify project reference is correct
   - Check network connectivity

2. **SMS Not Sending**:

   - Verify Twilio credentials are correct
   - Check Twilio account balance
   - Verify phone numbers are in E.164 format (+1234567890)
   - Check Supabase Edge Function logs

3. **Database Permission Errors**:

   - Verify RLS policies are enabled
   - Check user authentication
   - Ensure service role key is used for Edge Functions

4. **App Integration Issues**:
   - Check console logs for error details
   - Verify API endpoints are correct
   - Test network connectivity

### Debug Commands

```bash
# Check Edge Function logs
supabase functions logs send-emergency-sms

# Test database connection
supabase db pull

# Verify secrets are set
supabase secrets list
```

## Security Notes

- Never commit Twilio credentials to version control
- Use Supabase secrets for sensitive data
- Enable RLS policies on all tables
- Regularly rotate Twilio auth tokens
- Monitor SMS usage to prevent abuse

## Performance Optimization

- SMS logs are automatically cleaned up after 30 days
- Consider rate limiting for SMS sending
- Monitor Twilio usage and costs
- Use database indexing for large user bases

## Support

- Check Supabase Edge Function logs for server errors
- Review Twilio console for SMS delivery status
- Use app's "Validate SMS Setup" for configuration checks
- Contact support with specific error messages

## Next Steps

After setup is complete:

1. Test with real emergency contacts
2. Configure fall detection sensitivity
3. Set up SMS delivery monitoring
4. Consider adding emergency contact groups
5. Implement SMS template customization

Your server-side SMS emergency alert system is now ready for production use!
