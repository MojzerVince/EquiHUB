# EquiHUB Payment Setup Guide

This guide explains how to set up platform-specific payments for iOS App Store and Google Play Store subscriptions in EquiHUB.

## Current Implementation Status

✅ **Completed:**

- Payment service architecture with PaymentService class
- 7-day free trial implementation for first-time users
- Platform-specific subscription management
- Trial usage tracking with AsyncStorage
- Subscription status management
- Pro features screen with platform-specific information
- Enhanced subscription screen with trial and direct purchase options

⚠️ **Requires Setup:**

- react-native-iap library installation and configuration
- iOS App Store Connect configuration
- Google Play Console configuration
- Revenue Cat integration (recommended for production)

## Prerequisites

1. **Development Environment:**

   - React Native development environment set up
   - iOS development environment (Xcode) for iOS builds
   - Android development environment (Android Studio) for Android builds

2. **Developer Accounts:**
   - Apple Developer Program membership ($99/year) for iOS
   - Google Play Developer Console account ($25 one-time fee) for Android

## Step 1: Install Required Dependencies

### Install react-native-iap

```bash
npm install react-native-iap
# or
yarn add react-native-iap
```

### For iOS (Expo managed workflow):

```bash
npx expo install react-native-iap
```

### For iOS (Bare React Native):

```bash
cd ios && pod install
```

## Step 2: iOS App Store Setup

### 2.1 App Store Connect Configuration

1. **Create App in App Store Connect:**

   - Go to https://appstoreconnect.apple.com
   - Create new app with your bundle identifier
   - Fill in app information

2. **Create In-App Purchase Product:**

   - Go to App Store Connect → Your App → Features → In-App Purchases
   - Click the "+" button to create new product
   - Select "Auto-Renewable Subscription"
   - Product ID: `equihub_pro_monthly` (must match the ID in PaymentService)
   - Reference Name: `EquiHUB Pro Monthly`
   - Duration: 1 Month
   - Price: $9.99 USD

3. **Subscription Group:**

   - Create subscription group: "EquiHUB Pro"
   - Add your monthly subscription to this group

4. **App Review Information:**
   - Add screenshot of subscription screen
   - Provide review notes explaining trial and subscription features

### 2.2 iOS Implementation Code

Update `lib/paymentService.ts` to include actual iOS implementation:

```typescript
import { Platform } from 'react-native';
import {
  initConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  endConnection,
  requestSubscription,
  getSubscriptions,
  validateReceiptIos,
  finishTransaction,
  PurchaseResult,
  SubscriptionPurchase,
} from 'react-native-iap';

// Add this to your PaymentService class:
private async purchaseIOS(planId: string): Promise<PaymentResult> {
  try {
    await initConnection();

    // Get available subscriptions
    const subscriptions = await getSubscriptions([planId]);

    if (subscriptions.length === 0) {
      return {
        success: false,
        error: 'Subscription product not found'
      };
    }

    // Request subscription purchase
    const purchase = await requestSubscription({
      sku: planId,
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
    });

    // Validate receipt with your backend
    // const validationResult = await validateReceiptIos(purchase.transactionReceipt, false);

    // Finish transaction
    await finishTransaction({ purchase, isConsumable: false });

    // Save subscription locally
    const now = new Date();
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    const subscription: UserSubscription = {
      id: purchase.transactionId,
      plan: this.getSubscriptionPlans()[0],
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      trialUsed: await this.hasUsedTrial(),
      platform: 'ios',
      platformSubscriptionId: purchase.transactionId
    };

    await this.saveSubscription(subscription);

    return {
      success: true,
      subscriptionId: subscription.id,
      transactionId: purchase.transactionId
    };

  } catch (error) {
    console.error('iOS purchase error:', error);
    return {
      success: false,
      error: error.message || 'Purchase failed'
    };
  } finally {
    await endConnection();
  }
}
```

## Step 3: Google Play Store Setup

### 3.1 Google Play Console Configuration

1. **Create App in Google Play Console:**

   - Go to https://play.google.com/console
   - Create new app
   - Complete app details

2. **Create Subscription Product:**

   - Go to Monetization → Products → Subscriptions
   - Create new subscription
   - Product ID: `equihub_pro_monthly`
   - Name: `EquiHUB Pro Monthly`
   - Description: `Access to all EquiHUB Pro features including unlimited training history, advanced analytics, and premium tracking.`
   - Billing period: 1 month
   - Price: $9.99 USD
   - Free trial period: 7 days

3. **Configure Base Plan:**
   - Create base plan with 7-day free trial
   - Set renewal type to auto-renewing
   - Add pricing for different regions

### 3.2 Android Implementation Code

Update `lib/paymentService.ts` for Android:

```typescript
private async purchaseAndroid(planId: string): Promise<PaymentResult> {
  try {
    await initConnection();

    // Get available subscriptions
    const subscriptions = await getSubscriptions([planId]);

    if (subscriptions.length === 0) {
      return {
        success: false,
        error: 'Subscription product not found'
      };
    }

    // Request subscription purchase
    const purchase = await requestSubscription({
      sku: planId,
    });

    // Verify purchase with Google Play (recommended to do server-side)
    // await verifyPurchaseAndroid(purchase);

    // Save subscription locally
    const now = new Date();
    const endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    const subscription: UserSubscription = {
      id: purchase.purchaseToken,
      plan: this.getSubscriptionPlans()[0],
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      trialUsed: await this.hasUsedTrial(),
      platform: 'android',
      platformSubscriptionId: purchase.purchaseToken
    };

    await this.saveSubscription(subscription);

    return {
      success: true,
      subscriptionId: subscription.id,
      transactionId: purchase.purchaseToken
    };

  } catch (error) {
    console.error('Android purchase error:', error);
    return {
      success: false,
      error: error.message || 'Purchase failed'
    };
  } finally {
    await endConnection();
  }
}
```

## Step 4: Revenue Cat Integration (Recommended)

For easier subscription management, consider using Revenue Cat:

```bash
npm install react-native-purchases
```

### Revenue Cat Benefits:

- Cross-platform subscription management
- Server-side receipt validation
- Analytics and insights
- Easier implementation
- Better error handling

### Revenue Cat Setup:

1. Create account at https://www.revenuecat.com
2. Configure your app and products
3. Get API keys for iOS and Android
4. Update your implementation to use Revenue Cat SDK

## Step 5: Testing

### iOS Testing:

1. Create sandbox tester accounts in App Store Connect
2. Sign out of App Store on device
3. Sign in with sandbox account during testing
4. Test subscription purchase and trial

### Android Testing:

1. Upload signed APK to Google Play Console (Internal testing track)
2. Add test users to internal testing
3. Install app from Play Store (not sideloaded)
4. Test subscription purchase and trial

## Step 6: Production Deployment

### iOS:

1. Submit app for App Store review
2. Include subscription review information
3. Test with TestFlight before public release

### Android:

1. Submit app to Google Play
2. Configure production subscription products
3. Test with internal track before production release

## Security Considerations

1. **Server-Side Validation:**

   - Always validate receipts server-side
   - Never trust client-side purchase validation
   - Implement proper authentication

2. **Receipt Storage:**

   - Store encrypted receipts securely
   - Implement receipt refresh logic
   - Handle expired subscriptions gracefully

3. **User Data:**
   - Comply with App Store and Google Play policies
   - Implement proper privacy controls
   - Handle subscription cancellations properly

## Current Files Modified

1. **lib/paymentService.ts** - Complete payment service implementation
2. **app/pro-features.tsx** - Pro features screen with platform-specific management
3. **app/subscription.tsx** - Subscription screen with trial and purchase options

## Next Steps

1. Install react-native-iap dependency
2. Configure App Store Connect products
3. Configure Google Play Console products
4. Implement actual purchase logic in PaymentService
5. Test with sandbox/test accounts
6. Submit for store review

## Support

For additional help:

- iOS: https://developer.apple.com/in-app-purchase/
- Android: https://developer.android.com/google/play/billing
- react-native-iap: https://github.com/dooboolab/react-native-iap

## Price Settings

The current implementation uses:

- **Price:** $9.99/month
- **Trial:** 7 days free for first-time users
- **Platform:** iOS App Store & Google Play Store billing
