# Debug Server SMS Issues

## Issue Analysis

You're getting "Edge Function returned a non-2xx status code" which indicates the function is being called but returning an error status.

## Quick Debugging Steps

### 1. Check Function Deployment Status

Run these commands to deploy the functions:

```powershell
# Deploy send-emergency-sms function
npx supabase functions deploy send-emergency-sms --project-ref grdsqxwghajehneksxik

# Deploy get-sms-status function
npx supabase functions deploy get-sms-status --project-ref grdsqxwghajehneksxik
```

### 2. Check Environment Variables

Verify these are set in your Supabase project:

```powershell
# List current secrets
npx supabase secrets list --project-ref grdsqxwghajehneksxik

# Set required secrets (if missing)
npx supabase secrets set TWILIO_ACCOUNT_SID="your_account_sid" --project-ref grdsqxwghajehneksxik
npx supabase secrets set TWILIO_AUTH_TOKEN="your_auth_token" --project-ref grdsqxwghajehneksxik
npx supabase secrets set TWILIO_PHONE_NUMBER="your_twilio_number" --project-ref grdsqxwghajehneksxik
```

### 3. Check Database Setup

Make sure you've run the database setup SQL:

- File: `EMERGENCY_SMS_DATABASE_SETUP.sql`
- Run in Supabase SQL Editor

### 4. Check Function Logs

View the function logs for detailed error information:

```powershell
# Check logs for the SMS function
npx supabase functions logs send-emergency-sms --project-ref grdsqxwghajehneksxik
```

### 5. Test with Manual cURL

Test the function directly to get detailed error:

```bash
curl -X POST 'https://grdsqxwghajehneksxik.supabase.co/functions/v1/send-emergency-sms' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "test-user-id",
    "message": "Test message",
    "emergencyType": "test",
    "timestamp": 1693987200000
  }'
```

## Common Issues & Solutions

### Issue 1: Function Not Deployed

**Symptoms**: Edge Function error
**Solution**: Deploy the functions using the commands above

### Issue 2: Missing Environment Variables

**Symptoms**: "SMS service not configured" error
**Solution**: Set Twilio credentials as secrets

### Issue 3: Missing Database Tables

**Symptoms**: Database errors in function logs
**Solution**: Run the database setup SQL

### Issue 4: No Emergency Contacts

**Symptoms**: "No emergency contacts configured" error  
**Solution**: Add test emergency contacts:

```sql
INSERT INTO emergency_contacts (user_id, name, phone_number, relationship, is_primary, is_enabled)
VALUES (
  'your-user-id-here',
  'Test Contact',
  '+1234567890',
  'family',
  true,
  true
);
```

### Issue 5: Authentication Problems

**Symptoms**: Permission denied errors
**Solution**: Ensure user is properly authenticated and RLS policies are set

## Next Steps

1. **Deploy the functions** (most likely cause)
2. **Check function logs** for specific error messages
3. **Verify environment variables** are set
4. **Test database setup** with emergency contacts

Run the deployment commands first, then test again!
