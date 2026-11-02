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
    origin: config.appOrigin,
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
