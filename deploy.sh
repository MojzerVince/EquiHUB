#!/bin/bash

# 🚀 Quick Deployment Script for Railway

echo "🔧 Preparing for production deployment..."

# 1. Build the server
cd server
echo "📦 Building TypeScript..."
npm run build

# 2. Test the build
echo "🧪 Testing build..."
if [ ! -f "dist/secure-api-proxy.js" ]; then
    echo "❌ Build failed! Check for TypeScript errors."
    exit 1
fi

echo "✅ Build successful!"

# 3. Remind about environment variables
echo ""
echo "🔒 IMPORTANT: Don't forget to set these environment variables in Railway:"
echo "   NODE_ENV=production"
echo "   API_SECRET_KEY=your-super-secure-secret-key-2024"
echo "   ALLOWED_ORIGINS=https://exp.host"
echo "   ALLOWED_BUNDLE_IDS=com.equihub.app"
echo "   SUPABASE_URL=your-supabase-url"
echo "   SUPABASE_ANON_KEY=your-supabase-anon-key"
echo "   GOOGLE_MAPS_API_KEY=your-google-maps-key"
echo ""

# 4. Git commit reminder
echo "📝 Next steps:"
echo "   1. git add ."
echo "   2. git commit -m 'Production-ready server'"
echo "   3. git push origin main"
echo "   4. Deploy on Railway/Render/Vercel"
echo "   5. Update mobile app's EXPO_PUBLIC_API_SERVER_URL"

echo ""
echo "🎉 Ready for deployment!"
