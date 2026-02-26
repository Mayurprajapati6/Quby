import express from 'express';
import { createServer } from 'http';
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
import { initSocket } from './socket/socket.service';
import { startWorkers, stopWorkers } from './workers';
import { closeQueues } from './config/bullmq';
import { closeRedisConnections } from './config/redis';

const app = express();

app.use(cors({
    origin:      serverConfig.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(attachCorrelationIdMiddleware);
app.use('/api', apiLimiter);

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

app.use(appErrorHandler);
app.use(genericErrorHandler);

const httpServer = createServer(app);

const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully...`);

  httpServer.close(async () => {
    try {
      await stopWorkers();           
      await closeQueues();           
      await closeRedisConnections(); 
      await prisma.$disconnect();    
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced exit after 30s timeout');
    process.exit(1);
  }, 30_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM')); 
process.on('SIGINT',  () => shutdown('SIGINT'));  

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

prisma.$connect()
  .then(() => {
    logger.info('Database connected successfully');

    initSocket(httpServer);
    logger.info('Socket.io initialized');

    startWorkers();
    logger.info('BullMQ workers started');

    httpServer.listen(serverConfig.PORT, () => {
      logger.info(`Server running on http://localhost:${serverConfig.PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to database:', err);
    process.exit(1);
  });