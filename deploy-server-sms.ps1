# EquiHub Server SMS Deployment Script (PowerShell)
# This script automates the deployment of the server-side SMS system

Write-Host "🚀 EquiHub Server SMS Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check if Supabase CLI is installed
try {
    supabase --version | Out-Null
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI is not installed" -ForegroundColor Red
    Write-Host "Please install it with: npm install -g @supabase/cli" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in to Supabase
try {
    supabase projects list | Out-Null
    Write-Host "✅ Supabase login verified" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged in to Supabase" -ForegroundColor Red
    Write-Host "Please login with: supabase login" -ForegroundColor Yellow
    exit 1
}

# Get project reference
$PROJECT_REF = Read-Host "Enter your Supabase project reference"

if ([string]::IsNullOrEmpty($PROJECT_REF)) {
    Write-Host "❌ Project reference is required" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Using project reference: $PROJECT_REF" -ForegroundColor Cyan

# Deploy Edge Functions
Write-Host ""
Write-Host "🔄 Deploying Edge Functions..." -ForegroundColor Yellow

Write-Host "Deploying send-emergency-sms function..." -ForegroundColor Cyan
try {
    supabase functions deploy send-emergency-sms --project-ref $PROJECT_REF
    Write-Host "✅ send-emergency-sms deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy send-emergency-sms" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying get-sms-status function..." -ForegroundColor Cyan
try {
    supabase functions deploy get-sms-status --project-ref $PROJECT_REF
    Write-Host "✅ get-sms-status deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy get-sms-status" -ForegroundColor Red
    exit 1
}

# Set up environment variables
Write-Host ""
Write-Host "🔧 Setting up environment variables..." -ForegroundColor Yellow

$TWILIO_SID = Read-Host "Enter your Twilio Account SID"
$TWILIO_TOKEN = Read-Host "Enter your Twilio Auth Token" -MaskInput
$TWILIO_PHONE = Read-Host "Enter your Twilio Phone Number (with +)"

if ([string]::IsNullOrEmpty($TWILIO_SID) -or [string]::IsNullOrEmpty($TWILIO_TOKEN) -or [string]::IsNullOrEmpty($TWILIO_PHONE)) {
    Write-Host "❌ All Twilio credentials are required" -ForegroundColor Red
    exit 1
}

Write-Host "Setting Twilio Account SID..." -ForegroundColor Cyan
supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_SID" --project-ref $PROJECT_REF

Write-Host "Setting Twilio Auth Token..." -ForegroundColor Cyan
supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_TOKEN" --project-ref $PROJECT_REF

Write-Host "Setting Twilio Phone Number..." -ForegroundColor Cyan
supabase secrets set TWILIO_PHONE_NUMBER="$TWILIO_PHONE" --project-ref $PROJECT_REF

Write-Host "✅ Environment variables configured" -ForegroundColor Green

# Database setup reminder
Write-Host ""
Write-Host "📊 Database Setup Required" -ForegroundColor Yellow
Write-Host "==========================" -ForegroundColor Yellow
Write-Host "Please run the following SQL in your Supabase SQL editor:" -ForegroundColor Cyan
Write-Host "File: EMERGENCY_SMS_DATABASE_SETUP.sql" -ForegroundColor White
Write-Host ""
Write-Host "This will create the necessary tables and RLS policies." -ForegroundColor Cyan

# Test deployment
Write-Host ""
Write-Host "🧪 Testing Deployment..." -ForegroundColor Yellow

Write-Host "You can test the deployment with:" -ForegroundColor Cyan
Write-Host ""
Write-Host "curl -X POST 'https://$PROJECT_REF.supabase.co/functions/v1/send-emergency-sms' \" -ForegroundColor White
Write-Host "  -H 'Authorization: Bearer YOUR_ANON_KEY' \" -ForegroundColor White
Write-Host "  -H 'Content-Type: application/json' \" -ForegroundColor White
Write-Host "  -d '{" -ForegroundColor White
Write-Host "    ""userId"": ""test-user-id""," -ForegroundColor White
Write-Host "    ""alertType"": ""test""," -ForegroundColor White
Write-Host "    ""message"": ""Test SMS from EquiHub server""," -ForegroundColor White
Write-Host "    ""location"": {""latitude"": 40.7128, ""longitude"": -74.0060}" -ForegroundColor White
Write-Host "  }'" -ForegroundColor White

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run the database setup SQL (EMERGENCY_SMS_DATABASE_SETUP.sql)" -ForegroundColor White
Write-Host "2. Test the SMS functionality in the EquiHub app" -ForegroundColor White
Write-Host "3. Add emergency contacts for your users" -ForegroundColor White
Write-Host "4. Validate the setup using the app's validation tools" -ForegroundColor White
Write-Host ""
Write-Host "For detailed setup instructions, see: COMPLETE_SERVER_SMS_SETUP.md" -ForegroundColor Cyan
