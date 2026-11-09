import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'threadflow_access_secret_super_secure_key_12345',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '45m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'threadflow_refresh_secret_super_secure_key_67890',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryDays: 7,
  },
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY || 'e839f99e4f57c2a939f4039bca3bda4959cfc82dae11a221fbc34d580f1249fa',
  simulatedTodayDate: process.env.SIMULATED_TODAY_DATE || '',
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    model: process.env.AI_MODEL || 'gemini-3.1-flash-lite',
    apiKey: process.env.AI_API_KEY || '',
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '8000', 10),
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.65'),
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'notifications@threadflow.app',
  },
};
