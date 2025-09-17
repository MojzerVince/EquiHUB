/**
 * Secure API Proxy Server
 * This server acts as a middleman between your app and external APIs
 * to keep API keys secure on the server side
 */

import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import { config } from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

// Load environment variables
config();

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://grdsqxwghajehneksxik.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google User interface
interface GoogleUser {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

/**
 * Authenticates or creates a user in Supabase using Google credentials
 */
async function authenticateGoogleUser(googleUser: GoogleUser) {
  try {
    console.log('🔍 Authenticating Google user:', googleUser.email);
    
    // Check if user already exists by Google ID
    const { data: existingUser, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('google_id', googleUser.id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error checking existing user:', fetchError);
      throw fetchError;
    }
    
    let user;
    let isNewUser = false;
    
    if (existingUser) {
      console.log('✅ Existing user found, updating profile');
      
      // Update existing user with latest Google info
      const { data: updatedUser, error: updateError } = await supabase
        .from('profiles')
        .update({
          email: googleUser.email,
          name: googleUser.name,
          profile_image_url: googleUser.picture,
          updated_at: new Date().toISOString()
        })
        .eq('google_id', googleUser.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
      
      user = updatedUser;
    } else {
      console.log('🆕 New user, creating profile');
      isNewUser = true;
      
      // Create new user record
      const newUserData = {
        email: googleUser.email,
        name: googleUser.name,
        google_id: googleUser.id,
        profile_image_url: googleUser.picture,
        age: 0, // Default value, user can update later
        description: '', // Default empty description
        experience: 0, // Default beginner level
        is_pro_member: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: createdUser, error: createError } = await supabase
        .from('profiles')
        .insert([newUserData])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      
      user = createdUser;
      console.log('✅ New user created successfully');
    }
    
    return { user, isNewUser };
  } catch (error) {
    console.error('❌ Error in authenticateGoogleUser:', error);
    throw error;
  }
}

console.log('🔍 DEBUG: Railway PORT env var:', process.env.PORT);
console.log('🔍 DEBUG: Using PORT:', PORT);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8081'],
  credentials: true,
}));

// Debug middleware to log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 DEBUG: ${req.method} ${req.path} - Headers:`, req.headers);
  next();
});

// Validate API secret for authentication
const validateApiSecret = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔍 DEBUG: Incoming request to', req.path);
  console.log('🔍 DEBUG: Request headers:', req.headers);
  console.log('🔍 DEBUG: Request body:', req.body);
  
  const providedSecret = req.headers['x-app-secret'];
  const expectedSecret = process.env.API_SECRET_KEY;

  console.log('🔍 DEBUG: Provided secret:', providedSecret ? '***' + String(providedSecret).slice(-4) : 'MISSING');
  console.log('🔍 DEBUG: Expected secret:', expectedSecret ? '***' + expectedSecret.slice(-4) : 'MISSING');

  if (!providedSecret || !expectedSecret) {
    console.log('🔍 DEBUG: Authentication failed - missing secrets');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (providedSecret !== expectedSecret) {
    console.log('🔍 DEBUG: Authentication failed - secret mismatch');
    return res.status(403).json({ error: 'Invalid authentication' });
  }

  console.log('🔍 DEBUG: Authentication successful');
  next();
};

// Rate limiting middleware
const rateLimitStore = new Map();
const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // max requests per window

  if (!rateLimitStore.has(clientId)) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const clientData = rateLimitStore.get(clientId);
  
  if (now > clientData.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (clientData.count >= maxRequests) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  clientData.count++;
  next();
};

app.use(rateLimit);

/**
 * Health check endpoint
 */
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'EquiHUB Secure API Server',
    version: process.env.API_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'POST /config',
      'POST /test-config'
    ]
  });
});

/**
 * Test configuration endpoint (without auth for debugging)
 */
app.post('/test-config', (req: Request, res: Response) => {
  console.log('🔍 DEBUG: Test config endpoint reached!');
  res.json({ 
    message: 'Test endpoint working',
    body: req.body,
    headers: req.headers
  });
});

/**
 * Secure configuration endpoint (GET version)
 * Returns API keys and configuration for authenticated apps only
 */
app.get('/config', validateApiSecret, (req: Request, res: Response) => {
  try {
    console.log('🔍 DEBUG: GET Config endpoint reached successfully');
    
    // For GET requests, we can't get appVersion/bundleId from body
    // So we'll use query parameters or skip validation
    const appVersion = req.query.appVersion as string || 'unknown';
    const bundleId = req.query.bundleId as string || 'com.mojzi1969.EquiHUB';

    console.log('🔍 DEBUG: App version:', appVersion);
    console.log('🔍 DEBUG: Bundle ID:', bundleId);

    // Validate app identity
    const allowedBundleIds = process.env.ALLOWED_BUNDLE_IDS?.split(',') || [];
    console.log('🔍 DEBUG: Allowed bundle IDs:', allowedBundleIds);
    
    if (allowedBundleIds.length > 0 && !allowedBundleIds.includes(bundleId)) {
      console.log('🔍 DEBUG: Bundle ID not authorized');
      return res.status(403).json({ error: 'App not authorized' });
    }

    // Return secure configuration
    const config = {
      supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
      },
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
      server: {
        baseUrl: process.env.API_SERVER_URL,
      },
    };

    console.log('🔍 DEBUG: Sending config with keys:', config ? Object.keys(config) : 'null');
    res.json(config);
  } catch (error) {
    console.error('❌ Config endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Secure configuration endpoint (POST version)
 * Returns API keys and configuration for authenticated apps only
 */
app.post('/config', validateApiSecret, (req: Request, res: Response) => {
  try {
    console.log('🔍 DEBUG: Config endpoint reached successfully');
    const { appVersion, bundleId } = req.body;

    console.log('🔍 DEBUG: App version:', appVersion);
    console.log('🔍 DEBUG: Bundle ID:', bundleId);

    // Validate app identity (optional - add your app's bundle ID check)
    const allowedBundleIds = process.env.ALLOWED_BUNDLE_IDS?.split(',') || [];
    console.log('🔍 DEBUG: Allowed bundle IDs:', allowedBundleIds);
    
    if (allowedBundleIds.length > 0 && !allowedBundleIds.includes(bundleId)) {
      console.log('🔍 DEBUG: Bundle ID not authorized');
      return res.status(403).json({ error: 'App not authorized' });
    }

    // Return secure configuration
    const config = {
      supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        // Never send service role key to client
      },
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
      server: {
        baseUrl: process.env.API_SERVER_URL,
        // Never send API secret to client
      },
    };

    console.log('🔍 DEBUG: Sending config with keys:', Object.keys(config));
    res.json(config);
  } catch (error) {
    console.error('Config endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Proxy endpoint for Google Maps API
 * Keeps the API key on server side
 */
app.get('/maps/geocode', validateApiSecret, async (req: Request, res: Response) => {
  try {
    const { address, latlng } = req.query;
    
    if (!address && !latlng) {
      return res.status(400).json({ error: 'Address or latlng parameter required' });
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    const params = new URLSearchParams({
      key: process.env.GOOGLE_MAPS_API_KEY!,
      ...(address ? { address: address as string } : {}),
      ...(latlng ? { latlng: latlng as string } : {}),
    });

    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Geocoding proxy error:', error);
    res.status(500).json({ error: 'Geocoding service unavailable' });
  }
});

/**
 * Proxy endpoint for Google Places API
 */
app.get('/maps/places', validateApiSecret, async (req: Request, res: Response) => {
  try {
    const { query, location, radius = 5000 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const params = new URLSearchParams({
      key: process.env.GOOGLE_MAPS_API_KEY!,
      query: query as string,
      ...(location ? { location: location as string } : {}),
      radius: radius as string,
    });

    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Places proxy error:', error);
    res.status(500).json({ error: 'Places service unavailable' });
  }
});

/**
 * Google OAuth endpoint
 * Handles Google Sign In token exchange using client secret
 */
app.post('/auth/google', validateApiSecret, async (req: Request, res: Response) => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    console.log('🔍 DEBUG: Google OAuth token exchange');
    
    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      client_id: process.env.GOOGLE_WEB_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri || 'postmessage', // For mobile apps
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Google token exchange failed:', error);
      return res.status(400).json({ error: 'Token exchange failed' });
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    
    // Get user info using the access token
    const userResponse = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenData.access_token}`
    );

    if (!userResponse.ok) {
      const error = await userResponse.text();
      console.error('Google user info fetch failed:', error);
      return res.status(400).json({ error: 'Failed to get user info' });
    }

    const userInfo = await userResponse.json() as GoogleUser;
    
    console.log('🔍 DEBUG: Google user info received:', userInfo.email);
    
    // Authenticate/create user in Supabase
    const { user: supabaseUser, isNewUser } = await authenticateGoogleUser(userInfo);
    
    console.log('✅ User authenticated in Supabase:', supabaseUser.email, isNewUser ? '(new user)' : '(existing user)');
    
    // Return both Google user info and Supabase user data
    res.json({
      user: supabaseUser,
      googleUser: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
        locale: userInfo.locale,
      },
      isNewUser
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'OAuth service unavailable' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
  });
});

/**
 * Error handling middleware
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * 404 handler
 */
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`🔒 Secure API proxy server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Validate required environment variables
  const requiredEnvVars = [
    'API_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_WEB_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
});

// Handle server errors
server.on('error', (error: any) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
