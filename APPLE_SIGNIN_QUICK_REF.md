# Quick Reference: Supabase Apple Provider Settings

## 📋 Copy-Paste Values

### Client IDs

```
com.mojzi1969.EquiHUB.auth,com.mojzi1969.EquiHUB
```

### Secret Key (for OAuth)

**You need to generate this using one of these methods:**

#### Method 1: Use Our Script (Recommended)

```bash
cd /Users/mojzervince/Desktop/EquiHUB
npm install jsonwebtoken
node scripts/generate-apple-secret.js
```

Then copy the output.

#### Method 2: Manual Generation

If the script doesn't work, you can generate it manually:

1. Install dependencies:

   ```bash
   npm install jsonwebtoken
   ```

2. Create a quick Node.js script:

   ```javascript
   const jwt = require("jsonwebtoken");
   const fs = require("fs");

   const privateKey = fs.readFileSync("AuthKey_D99G99S9CQ.p8", "utf8");
   const now = Math.floor(Date.now() / 1000);

   const token = jwt.sign(
     {
       iss: "NLMGF499CX",
       iat: now,
       exp: now + 15780000,
       aud: "https://appleid.apple.com",
       sub: "com.mojzi1969.EquiHUB.auth",
     },
     privateKey,
     {
       algorithm: "ES256",
       keyid: "D99G99S9CQ",
     }
   );

   console.log(token);
   ```

3. Run it:
   ```bash
   node generate-token.js
   ```

### Allow users without an email

✅ **Check this box** (allows "Hide My Email" feature)

### Callback URL

```
https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback
```

_(Should be auto-filled)_

---

## 🔍 What Each Field Means

**Client IDs:**

- Contains both your Services ID and Bundle ID
- Format: `ServicesID,BundleID`
- Used for both web OAuth and native iOS authentication

**Secret Key:**

- A JWT token (NOT the raw .p8 file)
- Contains your Team ID, Key ID, and is signed with your private key
- Valid for 6 months
- Used only for web/OAuth flow

**Allow users without an email:**

- Enables Apple's "Hide My Email" privacy feature
- Users can authenticate without sharing their real email
- Apple provides a private relay email instead

**Callback URL:**

- Where Apple redirects after successful authentication
- Must match what you configured in Apple Developer Portal
- Automatically provided by Supabase

---

## ⚠️ Common Mistakes

❌ **Don't** paste the raw `.p8` file content as the secret key
✅ **Do** generate a JWT token using the script

❌ **Don't** put spaces in the Client IDs field
✅ **Do** use comma without spaces: `id1,id2`

❌ **Don't** forget to enable "Allow users without an email"
✅ **Do** check this box to support privacy-conscious users

---

## 📝 Your Values Summary

| Field       | Value                        |
| ----------- | ---------------------------- |
| Team ID     | `NLMGF499CX`                 |
| Key ID      | `D99G99S9CQ`                 |
| Services ID | `com.mojzi1969.EquiHUB.auth` |
| Bundle ID   | `com.mojzi1969.EquiHUB`      |
| Key File    | `AuthKey_D99G99S9CQ.p8`      |

---

## 🚀 Quick Setup Steps

1. **Generate Secret:**

   ```bash
   node scripts/generate-apple-secret.js
   ```

2. **Open Supabase:**

   - Go to Authentication → Providers → Apple

3. **Fill in fields:**

   - Client IDs: `com.mojzi1969.EquiHUB.auth,com.mojzi1969.EquiHUB`
   - Secret Key: [paste generated JWT]
   - Allow users without email: ✅
   - Callback URL: (should be pre-filled)

4. **Save**

5. **Test:**
   - Rebuild iOS app
   - Try Apple Sign-In on device

---

## ⏰ Reminder

- Secret key expires in **6 months**
- Set calendar reminder to regenerate before: **May 19, 2026**
- Run the script again when needed

---

## 🆘 Troubleshooting

**Script fails?**

- Make sure `.p8` file is in `scripts/` directory
- Check that `jsonwebtoken` is installed
- Verify Node.js is installed

**"Invalid secret" in Supabase?**

- Make sure you generated a JWT, not pasting raw .p8 content
- Verify Team ID, Key ID, and Services ID are correct
- Try regenerating the secret

**Apple Sign-In fails after setup?**

- Verify Client IDs are exactly: `com.mojzi1969.EquiHUB.auth,com.mojzi1969.EquiHUB`
- Check callback URL matches in both Apple and Supabase
- Rebuild your iOS app
- Test on a real device (not simulator)

https://grdsqxwghajehneksxik.supabase.co/auth/v1/callback
