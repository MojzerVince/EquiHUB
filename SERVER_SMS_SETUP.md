# Server-Side SMS Setup for EquiHUB Emergency Alerts

This document outlines how to set up server-side SMS functionality for sending emergency alerts through Supabase Edge Functions instead of relying on device SMS capabilities.

## Benefits of Server-Side SMS

1. **Reliability**: Server SMS works even if the device has poor cellular reception or SMS restrictions
2. **Security**: SMS credentials are stored securely on the server, not on the device
3. **Consistency**: All users get the same experience regardless of device capabilities
4. **Tracking**: Better logging and delivery status tracking
5. **Scalability**: Can handle high volumes of emergency alerts

## Setup Instructions

### 1. Database Setup

Run the SQL script to create the necessary tables:

```bash
# Execute the SQL script in Supabase Dashboard
# File: EMERGENCY_SMS_DATABASE_SETUP.sql
```

### 2. Supabase Edge Functions Setup

Deploy the Edge Functions to your Supabase project:

```bash
# Install Supabase CLI if not already installed
npm install -g @supabase/cli

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the functions
supabase functions deploy send-emergency-sms
supabase functions deploy get-sms-status
```

### 3. Environment Variables

Set up the following environment variables in your Supabase project:

```bash
# Supabase secrets (set these in Supabase Dashboard -> Settings -> Edge Functions)
supabase secrets set TWILIO_ACCOUNT_SID=your_twilio_account_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_twilio_auth_token
supabase secrets set TWILIO_FROM_NUMBER=your_twilio_phone_number
```

### 4. Twilio Setup (Recommended SMS Provider)

1. **Create Twilio Account**: Sign up at https://www.twilio.com
2. **Get Credentials**:
   - Account SID from Twilio Console
   - Auth Token from Twilio Console
   - Phone Number from Twilio Console (must be verified for production)
3. **Configure Webhooks** (optional): Set up delivery status webhooks for better tracking

### 5. Alternative SMS Providers

You can replace Twilio with other SMS providers by modifying the Edge Function. Popular alternatives:

- **AWS SNS**: Cost-effective for high volumes
- **MessageBird**: Good international coverage
- **Vonage (Nexmo)**: Reliable delivery rates
- **SendGrid**: If you're already using SendGrid for email

### 6. Testing the Implementation

1. **Test Emergency Contacts**: Add emergency contacts in the app
2. **Test Fall Detection**: Use the test button in the fall detection modal
3. **Monitor Logs**: Check Supabase Edge Function logs for any issues
4. **Verify Delivery**: Check the SMS delivery status in the database

## How It Works

### Fall Detection Flow

```
1. Sensors detect potential fall
2. FallDetectionAPI.sendFallAlert() called
3. ServerSMSAPI.sendFallAlert() invoked
4. Supabase Edge Function processes request
5. Function fetches user's emergency contacts
6. SMS sent via Twilio to each contact
7. Delivery status logged in database
8. Response returned to app
```

### Fallback Mechanism

The system implements a fallback mechanism:

1. **Primary**: Server SMS via Supabase Edge Function
2. **Fallback**: Direct device SMS (original implementation)

If server SMS fails, the app automatically falls back to direct SMS.

## Database Schema

### emergency_sms_log

- Stores all emergency SMS requests
- Links to user and contains message details
- Tracks success/failure rates

### sms_delivery_status

- Individual delivery status for each phone number
- Tracks sent/delivered/failed status per contact
- Links to provider message IDs for tracking

### emergency_contacts

- User's emergency contact information
- Includes enable/disable status per contact

## Security Considerations

1. **RLS Policies**: Row Level Security ensures users only see their own data
2. **Service Role**: Edge Functions use service role for database access
3. **Environment Variables**: SMS credentials are stored as encrypted secrets
4. **Data Encryption**: All sensitive data is encrypted in transit and at rest

## Monitoring and Maintenance

### Key Metrics to Monitor

1. **SMS Success Rate**: Track successful deliveries vs failures
2. **Response Times**: Monitor Edge Function execution times
3. **Error Rates**: Watch for patterns in failed deliveries
4. **Cost**: Monitor SMS usage and costs

### Logs to Check

- Supabase Edge Function logs
- Twilio delivery logs
- Database emergency_sms_log entries
- App-side console logs

## Troubleshooting

### Common Issues

1. **No Emergency Contacts**: Users must configure contacts first
2. **Invalid Phone Numbers**: Ensure proper formatting (+1234567890)
3. **Twilio Credentials**: Verify account SID, auth token, and from number
4. **Network Issues**: Edge Functions need internet connectivity
5. **Rate Limits**: Twilio has rate limits for free accounts

### Testing Steps

1. Check Supabase Edge Function deployment
2. Verify environment variables are set
3. Test with known working phone numbers
4. Check database for log entries
5. Verify Twilio account status and credits

## Cost Optimization

1. **Message Length**: Shorter messages cost less
2. **Provider Rates**: Compare SMS provider pricing
3. **Delivery Reports**: Only enable if needed (costs extra)
4. **Geographic Rates**: International SMS costs more

## Future Enhancements

1. **Rich Media**: MMS support for location images
2. **Multiple Providers**: Automatic failover between SMS providers
3. **Voice Calls**: Escalate to voice calls if SMS fails
4. **Push Notifications**: Alternative alert method
5. **Email Backup**: Send email copies of alerts
