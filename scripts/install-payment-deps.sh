#!/bin/bash

# EquiHUB Payment Dependencies Installation Script

echo "🚀 Installing EquiHUB Payment Dependencies..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the EquiHUB project root directory."
    exit 1
fi

# Install react-native-iap for in-app purchases
echo "📱 Installing react-native-iap..."
npm install react-native-iap

# Check if expo is being used
if [ -f "app.json" ] && grep -q "expo" package.json; then
    echo "📦 Detected Expo project. Installing expo-compatible version..."
    npx expo install react-native-iap
fi

# Install additional dependencies that might be useful for payments
echo "🔐 Installing additional security dependencies..."
npm install @react-native-async-storage/async-storage

# For iOS, remind about CocoaPods
if [ "$(uname)" == "Darwin" ]; then
    echo "🍎 iOS detected. Don't forget to run 'cd ios && pod install' after this script completes."
fi

echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. For iOS: Run 'cd ios && pod install' (if using bare React Native)"
echo "2. Configure App Store Connect (see PAYMENT_SETUP_GUIDE.md)"
echo "3. Configure Google Play Console (see PAYMENT_SETUP_GUIDE.md)"
echo "4. Update lib/paymentService.ts with actual implementation"
echo "5. Test with sandbox accounts"
echo ""
echo "📚 See PAYMENT_SETUP_GUIDE.md for detailed setup instructions."
