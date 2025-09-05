@echo off

REM EquiHUB Payment Dependencies Installation Script (Windows)

echo 🚀 Installing EquiHUB Payment Dependencies...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the EquiHUB project root directory.
    pause
    exit /b 1
)

REM Install react-native-iap for in-app purchases
echo 📱 Installing react-native-iap...
call npm install react-native-iap

REM Check if expo is being used
if exist "app.json" (
    findstr "expo" package.json >nul
    if %errorlevel% equ 0 (
        echo 📦 Detected Expo project. Installing expo-compatible version...
        call npx expo install react-native-iap
    )
)

REM Install additional dependencies that might be useful for payments
echo 🔐 Installing additional security dependencies...
call npm install @react-native-async-storage/async-storage

echo ✅ Dependencies installed successfully!
echo.
echo Next steps:
echo 1. Configure App Store Connect (see PAYMENT_SETUP_GUIDE.md)
echo 2. Configure Google Play Console (see PAYMENT_SETUP_GUIDE.md)
echo 3. Update lib/paymentService.ts with actual implementation
echo 4. Test with sandbox accounts
echo.
echo 📚 See PAYMENT_SETUP_GUIDE.md for detailed setup instructions.

pause
