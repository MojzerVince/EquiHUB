# Package.json Dependencies Update

Add these dependencies to your package.json for payment functionality:

## Required Dependencies

```json
{
  "dependencies": {
    "react-native-iap": "^12.10.7",
    "@react-native-async-storage/async-storage": "^1.21.0"
  }
}
```

## Optional Dependencies (Recommended for Production)

```json
{
  "dependencies": {
    "react-native-purchases": "^7.3.0",
    "react-native-keychain": "^8.1.3"
  }
}
```

## Installation Commands

### Basic Installation:

```bash
npm install react-native-iap @react-native-async-storage/async-storage
```

### With Revenue Cat (Recommended):

```bash
npm install react-native-purchases react-native-keychain
```

### For Expo Managed Workflow:

```bash
npx expo install react-native-iap @react-native-async-storage/async-storage
```

## Platform-Specific Setup

### iOS (if using bare React Native):

```bash
cd ios && pod install
```

### Android:

No additional setup required for basic functionality.

## What These Dependencies Provide:

1. **react-native-iap**: Core in-app purchase functionality for both iOS and Android
2. **@react-native-async-storage/async-storage**: Local storage for subscription state
3. **react-native-purchases** (optional): Revenue Cat SDK for easier subscription management
4. **react-native-keychain** (optional): Secure storage for sensitive subscription data
