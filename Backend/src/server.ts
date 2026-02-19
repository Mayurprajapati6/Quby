import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import v2Router from './routers/v2/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import logger from './config/logger.config';
import { attachCorrelationIdMiddleware } from './middlewares/correlation.middleware';
import { prisma } from './config/prisma';
import { apiLimiter } from './middlewares/rateLimiter.middleware';

const app = express();

app.use(cors({
  origin: serverConfig.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,         
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '10mb' }));   
app.use(cookieParser());                   
app.use(attachCorrelationIdMiddleware);

app.use('/api', apiLimiter);

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

app.use(appErrorHandler);
app.use(genericErrorHandler);


prisma.$connect()
  .then(() => {
    logger.info('Database connected successfully');

    const server = app.listen(serverConfig.PORT, () => {
      logger.info(`Server running on http://localhost:${serverConfig.PORT}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));   // Ctrl+C
  })
  .catch((error) => {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  });