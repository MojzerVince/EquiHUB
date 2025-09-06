#!/bin/bash

# EquiHub Server SMS Deployment Script
# This script automates the deployment of the server-side SMS system

echo "🚀 EquiHub Server SMS Deployment Script"
echo "========================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "Please install it with: npm install -g @supabase/cli"
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if user is logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase"
    echo "Please login with: supabase login"
    exit 1
fi

echo "✅ Supabase login verified"

# Get project reference
read -p "Enter your Supabase project reference: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

echo "📝 Using project reference: $PROJECT_REF"

# Deploy Edge Functions
echo ""
echo "🔄 Deploying Edge Functions..."

echo "Deploying send-emergency-sms function..."
if supabase functions deploy send-emergency-sms --project-ref $PROJECT_REF; then
    echo "✅ send-emergency-sms deployed successfully"
else
    echo "❌ Failed to deploy send-emergency-sms"
    exit 1
fi

echo "Deploying get-sms-status function..."
if supabase functions deploy get-sms-status --project-ref $PROJECT_REF; then
    echo "✅ get-sms-status deployed successfully"
else
    echo "❌ Failed to deploy get-sms-status"
    exit 1
fi

# Set up environment variables
echo ""
echo "🔧 Setting up environment variables..."

read -p "Enter your Twilio Account SID: " TWILIO_SID
read -p "Enter your Twilio Auth Token: " TWILIO_TOKEN
read -p "Enter your Twilio Phone Number (with +): " TWILIO_PHONE

if [ -z "$TWILIO_SID" ] || [ -z "$TWILIO_TOKEN" ] || [ -z "$TWILIO_PHONE" ]; then
    echo "❌ All Twilio credentials are required"
    exit 1
fi

echo "Setting Twilio Account SID..."
supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_SID" --project-ref $PROJECT_REF

echo "Setting Twilio Auth Token..."
supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_TOKEN" --project-ref $PROJECT_REF

echo "Setting Twilio Phone Number..."
supabase secrets set TWILIO_PHONE_NUMBER="$TWILIO_PHONE" --project-ref $PROJECT_REF

echo "✅ Environment variables configured"

# Database setup reminder
echo ""
echo "📊 Database Setup Required"
echo "=========================="
echo "Please run the following SQL in your Supabase SQL editor:"
echo "File: EMERGENCY_SMS_DATABASE_SETUP.sql"
echo ""
echo "This will create the necessary tables and RLS policies."

# Test deployment
echo ""
echo "🧪 Testing Deployment..."

# Get the project URL and anon key for testing
echo "You can test the deployment with:"
echo ""
echo "curl -X POST 'https://$PROJECT_REF.supabase.co/functions/v1/send-emergency-sms' \\"
echo "  -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"userId\": \"test-user-id\","
echo "    \"alertType\": \"test\","
echo "    \"message\": \"Test SMS from EquiHub server\","
echo "    \"location\": {\"latitude\": 40.7128, \"longitude\": -74.0060}"
echo "  }'"

echo ""
echo "🎉 Deployment Complete!"
echo "====================="
echo ""
echo "Next steps:"
echo "1. Run the database setup SQL (EMERGENCY_SMS_DATABASE_SETUP.sql)"
echo "2. Test the SMS functionality in the EquiHub app"
echo "3. Add emergency contacts for your users"
echo "4. Validate the setup using the app's validation tools"
echo ""
echo "For detailed setup instructions, see: COMPLETE_SERVER_SMS_SETUP.md"
