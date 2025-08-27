/**
 * Secure API Configuration Manager
 * Handles API keys and sensitive configuration in a secure way
 */

interface SecureConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  googleMaps: {
    apiKey: string;
  };
  server: {
    baseUrl: string;
    apiSecret: string;
  };
}

class SecureConfigManager {
  private static instance: SecureConfigManager;
  private config: SecureConfig | null = null;
  private isProduction: boolean = process.env.NODE_ENV === 'production';

  private constructor() {}

  static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  /**
   * Initialize configuration - call this early in app lifecycle
   */
  async initialize(): Promise<void> {
    try {
      // Always fetch config from secure server endpoint
      // This ensures API keys are never stored in the client
      await this.loadProductionConfig();
    } catch (error) {
      console.error('Failed to initialize secure config:', error);
      throw new Error('Configuration initialization failed');
    }
  }

  /**
   * Load configuration from secure server endpoint (production)
   */
  private async loadProductionConfig(): Promise<void> {
    try {
      const serverUrl = process.env.EXPO_PUBLIC_API_SERVER_URL;
      const apiSecret = process.env.EXPO_PUBLIC_API_SECRET;
      
      console.log('🔍 DEBUG: Attempting to connect to server:', serverUrl);
      console.log('🔍 DEBUG: Using API secret:', apiSecret ? '***' + apiSecret.slice(-4) : 'MISSING');
      
      const requestBody = {
        appVersion: require('../app.json').expo.version,
        bundleId: require('../app.json').expo.android.package,
      };
      console.log('🔍 DEBUG: Request body:', requestBody);
      
      // This endpoint should be protected and only return config for authenticated apps
      const response = await fetch(`${serverUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-secret': apiSecret || '',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 DEBUG: Response error text:', errorText);
        throw new Error(`Config fetch failed: ${response.status} - ${errorText}`);
      }

      this.config = await response.json();
      console.log('🔍 DEBUG: Config loaded successfully:', this.config ? Object.keys(this.config) : 'null');
    } catch (error) {
      console.error('Failed to load production config:', error);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables (development)
   */
  private loadDevelopmentConfig(): void {
    this.config = {
      supabase: {
        url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
        anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
      server: {
        baseUrl: process.env.API_SERVER_URL || 'http://localhost:3000/api',
        apiSecret: process.env.API_SECRET_KEY || '',
      },
    };

    // Validate required keys in development
    this.validateConfig();
  }

  /**
   * Validate that all required configuration is present
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const required = [
      this.config.supabase.url,
      this.config.supabase.anonKey,
      this.config.googleMaps.apiKey,
    ];

    if (required.some(key => !key)) {
      throw new Error('Missing required configuration keys');
    }
  }

  /**
   * Get Supabase configuration
   */
  getSupabaseConfig() {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return this.config.supabase;
  }

  /**
   * Get Google Maps API key
   */
  getGoogleMapsApiKey(): string {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return this.config.googleMaps.apiKey;
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }
    return this.config.server;
  }

  /**
   * Check if running in production mode
   */
  isProductionMode(): boolean {
    return this.isProduction;
  }

  /**
   * Clear configuration (for security)
   */
  clearConfig(): void {
    this.config = null;
  }
}

export const secureConfig = SecureConfigManager.getInstance();
export default secureConfig;
