import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './common/middleware/errorHandler';

export const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile curl/native fetch/same-origin proxies)
      if (!origin) return callback(null, true);

      // Allow localhost or local LAN IP addresses (for mobile phone access on same Wi-Fi)
      if (
        origin === config.appOrigin ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      callback(null, config.appOrigin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use(config.apiPrefix, apiRouter);

// Global Error Handler
app.use(errorHandler);
