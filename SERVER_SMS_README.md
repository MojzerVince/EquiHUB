# 📱 Server SMS Emergency Alert System

## Overview

Complete server-side SMS solution for EquiHub emergency alerts, replacing device SMS with reliable server-based messaging via Supabase Edge Functions and Twilio.

## 🚀 Quick Start

### 1. Deploy the System

```bash
# Windows PowerShell
.\deploy-server-sms.ps1

# Linux/Mac Bash
./deploy-server-sms.sh
```

### 2. Set Up Database

Run `EMERGENCY_SMS_DATABASE_SETUP.sql` in your Supabase SQL editor.

### 3. Test in App

1. Open EquiHub app
2. Go to Map screen → Emergency button
3. Tap "📱 Test Server SMS"
4. Tap "✅ Validate SMS Setup"

## 🔧 Manual Setup

See `COMPLETE_SERVER_SMS_SETUP.md` for detailed manual setup instructions.

## 📁 Key Files

### Core Implementation

- `lib/serverSMSAPI.ts` - Server SMS API client
- `lib/smsTestUtility.ts` - Testing and validation utilities
- `lib/fallDetectionAPI.ts` - Fall detection with server SMS integration
- `lib/emergencyContactsAPI.ts` - Emergency contacts with server SMS

### Supabase Edge Functions

- `supabase/functions/send-emergency-sms/` - SMS sending function
- `supabase/functions/get-sms-status/` - SMS status checking function

### Database & Setup

- `EMERGENCY_SMS_DATABASE_SETUP.sql` - Database schema and RLS policies
- `COMPLETE_SERVER_SMS_SETUP.md` - Comprehensive setup guide
- `deploy-server-sms.ps1` / `deploy-server-sms.sh` - Deployment scripts

## 🧪 Testing Features

### In-App Testing

- **Test Server SMS**: Send test messages via server
- **Validate SMS Setup**: Check configuration and connectivity
- **Fall Detection Test**: Test emergency alert system

### Test Utility Functions

```typescript
import { SMSTestUtility } from "../lib/smsTestUtility";

// Quick SMS test
await SMSTestUtility.testServerSMS(userId);

// Full test suite
await SMSTestUtility.runAllTests(userId);

// Validate setup
const validation = await SMSTestUtility.validateSetup(userId);
```

## 🔒 Security Features

- **RLS Policies**: Row-level security on all tables
- **Environment Variables**: Secure credential storage
- **User Authentication**: Authenticated API calls only
- **SMS Logging**: Complete audit trail

## 📊 Database Schema

### Key Tables

- `emergency_sms_log` - SMS delivery tracking
- `sms_delivery_status` - Delivery status updates
- `emergency_contacts` - User emergency contacts

### Automatic Features

- SMS delivery status tracking
- 30-day automatic log cleanup
- Real-time delivery updates
- Failed delivery notifications

## 🎯 Integration Points

### Fall Detection

- Automatic server SMS on fall detection
- Fallback to device SMS if server fails
- Configurable sensitivity settings

### Emergency Alerts

- Manual emergency button
- Location-based alerts
- Multiple contact support
- Custom message templates

## 💡 Benefits Over Device SMS

✅ **More Reliable**: Server-grade SMS delivery  
✅ **Better Tracking**: Delivery status and logs  
✅ **No Permissions**: No device SMS permissions needed  
✅ **Cross-Platform**: Works on all devices  
✅ **Scalable**: Handles high volume  
✅ **Customizable**: Rich message templates

## 🚨 Emergency Alert Types

- **Fall Detection**: Automatic sensor-based alerts
- **Manual Emergency**: User-triggered alerts
- **Location Updates**: GPS-based emergency notifications
- **Test Alerts**: System validation messages

## 📱 User Experience

### For End Users

1. Set up emergency contacts in profile
2. Enable fall detection if desired
3. System automatically handles emergencies
4. No SMS permissions or setup required

### For Developers

1. Deploy Edge Functions
2. Configure Twilio credentials
3. Run database setup
4. Test with validation tools

## 🔧 Configuration

### Required Environment Variables

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Optional Configurations

- SMS message templates
- Delivery retry logic
- Rate limiting settings
- Custom alert types

## 📈 Monitoring & Analytics

- SMS delivery success rates
- Response time tracking
- Error logging and alerts
- Usage analytics
- Cost monitoring

## 🆘 Troubleshooting

### Common Issues

1. **SMS not sending**: Check Twilio credentials and balance
2. **Permission errors**: Verify RLS policies and authentication
3. **Function deployment fails**: Check Supabase CLI setup
4. **Database errors**: Ensure schema is properly created

### Debug Tools

- In-app validation checks
- Console logging for all operations
- Supabase Edge Function logs
- Twilio delivery status webhooks

## 🔄 Fallback Strategy

The system includes a robust fallback mechanism:

1. **Primary**: Server SMS via Edge Functions
2. **Fallback**: Device SMS (if available)
3. **Notification**: User alert if both fail
4. **Logging**: All attempts tracked

## 📞 Support

For issues or questions:

1. Check console logs for error details
2. Use in-app validation tools
3. Review Supabase Edge Function logs
4. Check Twilio delivery status
5. Consult setup documentation

---

**Ready to deploy?** Run the deployment script and follow the setup guide for a complete server SMS emergency alert system!
