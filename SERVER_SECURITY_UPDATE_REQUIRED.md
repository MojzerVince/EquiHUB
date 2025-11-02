# 🔒 Server Security Update Required

## ✅ Client-Side Changes Completed

The API secret has been **removed from the client app** for security. The following files were updated:

- `.env` - Removed `EXPO_PUBLIC_API_SECRET`
- `lib/secureConfig.ts` - Removed API secret from config requests
- `lib/authAPI.ts` - Removed API secret from Google OAuth
- `components/AppInitializer.tsx` - Removed API secret from initialization

## ⚠️ Server-Side Changes Required

Your **Railway server** needs to be updated to work without the API secret validation. Here's what needs to change:

### 1. `/config` Endpoint (Current Implementation)

**Before (insecure):**

```javascript
app.post("/config", (req, res) => {
  const apiSecret = req.headers["x-app-secret"];

  // Validates against shared secret - INSECURE
  if (apiSecret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Invalid API secret" });
  }

  // Return config...
});
```

**After (secure):**

```javascript
app.post("/config", (req, res) => {
  const { bundleId, appVersion } = req.body;

  // Validate based on bundle ID (whitelist approach)
  const allowedBundleIds = [
    "com.mojzi1969.EquiHUB",
    // Add more if you have test/staging apps
  ];

  if (!allowedBundleIds.includes(bundleId)) {
    return res.status(403).json({
      error: "App not authorized",
      message: "Bundle ID not in allowed list",
    });
  }

  // Optional: Validate app version (prevent old versions)
  const minVersion = "0.9.0";
  if (compareVersions(appVersion, minVersion) < 0) {
    return res.status(403).json({
      error: "App version too old",
      message: "Please update the app",
    });
  }

  // Return config
  res.json({
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    },
    googleMaps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    server: {
      baseUrl: process.env.SERVER_URL,
    },
  });
});
```

### 2. `/auth/google` Endpoint (Current Implementation)

**Before (insecure):**

```javascript
app.post("/auth/google", async (req, res) => {
  const apiSecret = req.headers["x-app-secret"];

  // Validates against shared secret - INSECURE
  if (apiSecret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "Invalid API secret" });
  }

  const { code, redirectUri } = req.body;

  // Exchange code for tokens...
});
```

**After (secure):**

```javascript
app.post("/auth/google", async (req, res) => {
  const { code, redirectUri } = req.body;

  // No API secret validation needed!
  // The authorization code itself is the proof of authenticity
  // It's one-time use and comes from Google's OAuth flow

  if (!code) {
    return res.status(400).json({ error: "Authorization code required" });
  }

  try {
    // Exchange code for tokens with Google
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, // THIS stays on server
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(401).json({ error: "Invalid authorization code" });
    }

    // Get user info from Google
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    const googleUser = await userResponse.json();

    // Create/update user in your database (Supabase)
    // Then create a JWT session token
    const sessionToken = createJWT(googleUser.id); // Use proper JWT library

    res.json({
      user: googleUser,
      session: sessionToken, // Client stores this for future requests
    });
  } catch (error) {
    res.status(500).json({ error: "OAuth failed" });
  }
});
```

## 🎯 Why This is More Secure

### Old Approach (Shared Secret):

```
Client has: API_SECRET = "production-secret-key-2024"
Server has: API_SECRET = "production-secret-key-2024"
Problem: Anyone can extract the secret from the app
```

### New Approach (Bundle ID Validation + OAuth):

```
Client sends: { bundleId: "com.mojzi1969.EquiHUB" }
Server validates: Is this in my allowedBundleIds list?
Result: No secret to steal, server trusts based on app identity
```

## 📋 Implementation Checklist

On your Railway server:

- [ ] Remove `x-app-secret` header validation from `/config` endpoint
- [ ] Add bundle ID whitelist validation to `/config` endpoint
- [ ] Remove `x-app-secret` header validation from `/auth/google` endpoint
- [ ] Ensure Google OAuth Client Secret stays server-side only
- [ ] Test the `/config` endpoint without API secret
- [ ] Test the `/auth/google` endpoint without API secret
- [ ] Deploy updated server to Railway
- [ ] Verify client app can connect and authenticate

## 🔐 Additional Security Recommendations

1. **Rate Limiting**: Add rate limiting to prevent abuse

   ```javascript
   const rateLimit = require('express-rate-limit');

   const configLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });

   app.post('/config', configLimiter, (req, res) => { ... });
   ```

2. **CORS**: Restrict CORS to your app only

   ```javascript
   const cors = require("cors");

   app.use(
     cors({
       origin: ["exp://127.0.0.1:8081"], // Add your production domains
       credentials: true,
     })
   );
   ```

3. **Google Maps API Keys**: Add restrictions in Google Cloud Console
   - iOS key: Restrict to bundle ID `com.mojzi1969.EquiHUB`
   - Android key: Restrict to package name + SHA-1 certificate fingerprint
   - Both: Only enable "Maps SDK for iOS/Android" APIs
   - Both: Set daily quota limit (10,000 requests recommended)

## 🧪 Testing

After deploying server changes:

1. **Test Config Endpoint:**

   ```bash
   curl -X POST https://equihub-production.up.railway.app/config \
     -H "Content-Type: application/json" \
     -d '{"bundleId": "com.mojzi1969.EquiHUB", "appVersion": "0.9.2"}'
   ```

   Should return config without requiring API secret

2. **Test with Wrong Bundle ID:**

   ```bash
   curl -X POST https://equihub-production.up.railway.app/config \
     -H "Content-Type: application/json" \
     -d '{"bundleId": "com.fake.app", "appVersion": "0.9.2"}'
   ```

   Should return 403 Forbidden

3. **Test Google OAuth:**
   - Run the app and try Google Sign In
   - Should work without API secret

## 📞 Questions?

If you need help updating the server code, let me know and I can help write the specific implementation for your Railway server setup.
