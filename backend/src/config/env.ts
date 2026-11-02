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
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'threadflow_refresh_secret_super_secure_key_67890',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    refreshExpiryDays: 7,
  },
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY || 'e839f99e4f57c2a939f4039bca3bda4959cfc82dae11a221fbc34d580f1249fa',
  simulatedTodayDate: process.env.SIMULATED_TODAY_DATE || '2026-11-02',
};
