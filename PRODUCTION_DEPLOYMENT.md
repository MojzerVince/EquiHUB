# 🚀 Production Deployment Guide

## Option 1: Railway (Recommended)

### 1. Setup Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### 2. Deploy Your Server

1. Push your code to GitHub:

   ```bash
   git add .
   git commit -m "Add secure API proxy server"
   git push origin main
   ```

2. In Railway dashboard:

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your EquiHUB repository
   - Set root directory to `/server`

3. Configure Environment Variables in Railway:

   ```
   NODE_ENV=production
   API_SECRET_KEY=your-super-secure-secret-key-2024
   ALLOWED_ORIGINS=https://exp.host
   ALLOWED_BUNDLE_IDS=com.equihub.app
   SUPABASE_URL=https://grdsqxwghajehneksxik.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   GOOGLE_MAPS_API_KEY=your-google-maps-key
   ```

4. Railway will automatically:
   - Install dependencies
   - Build your TypeScript
   - Start the server
   - Provide a public URL like: `https://equihub-api-production.railway.app`

### 3. Update Your Mobile App

1. Update `.env` file:

   ```
   EXPO_PUBLIC_API_SERVER_URL=https://your-railway-url.railway.app
   EXPO_PUBLIC_API_SECRET=your-super-secure-secret-key-2024
   ```

2. Rebuild and test your app

## Option 2: Render

### 1. Setup Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### 2. Deploy Web Service

1. Click "New" → "Web Service"
2. Connect your GitHub repo
3. Configure:

   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node.js

4. Add environment variables (same as Railway)

## Option 3: Vercel (Serverless)

### 1. Create vercel.json in server folder:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/secure-api-proxy.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/secure-api-proxy.js"
    }
  ]
}
```

### 2. Deploy

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`
3. Configure environment variables in Vercel dashboard

## 🔒 Security Checklist for Production

### 1. Environment Variables

- [ ] Generate strong API_SECRET_KEY (32+ characters)
- [ ] Update ALLOWED_ORIGINS to your app's domain
- [ ] Set ALLOWED_BUNDLE_IDS to your app's bundle ID
- [ ] Never commit .env files to git

### 2. App Configuration

- [ ] Update EXPO_PUBLIC_API_SERVER_URL to production URL
- [ ] Update EXPO_PUBLIC_API_SECRET to match server
- [ ] Test configuration loading in production build

### 3. Monitoring

- [ ] Setup error logging (Railway/Render have built-in logs)
- [ ] Monitor API usage and rate limits
- [ ] Setup uptime monitoring

## 📱 Testing Production Setup

### 1. Test Server Endpoint

```bash
curl -X POST https://your-server.railway.app/config \
  -H "Content-Type: application/json" \
  -H "x-app-secret: your-production-secret" \
  -d '{"appVersion":"1.0.0","bundleId":"com.equihub.app"}'
```

### 2. Build Production App

```bash
# For development build
eas build --platform android --profile development

# For production build
eas build --platform android --profile production
```

## 💰 Cost Estimates

| Platform | Free Tier       | Paid Tier   |
| -------- | --------------- | ----------- |
| Railway  | $5 credit       | $5-10/month |
| Render   | 750 hours/month | $7/month    |
| Vercel   | 100GB-hours     | $20/month   |

## 🚨 Important Notes

1. **Never expose API keys in your mobile app code**
2. **Always use HTTPS in production**
3. **Regularly rotate your API secrets**
4. **Monitor your server logs for suspicious activity**
5. **Keep your dependencies updated**

## 🔄 Rollback Plan

If something goes wrong:

1. Keep your development server running locally
2. Change EXPO_PUBLIC_API_SERVER_URL back to localhost
3. Fix issues and redeploy
4. Test thoroughly before switching back to production URL
