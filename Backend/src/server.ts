import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { serverConfig } from "./config";
import logger from "./config/logger.config";
import { prisma } from "./config/prisma";
import { closeQueues } from "./config/bullmq";
import { closeRedisConnections } from "./config/redis";
import { initSocket } from "./socket/socket.service";
import { appErrorHandler, genericErrorHandler } from "./middlewares/error.middleware";
import { attachCorrelationIdMiddleware } from "./middlewares/correlation.middleware";
import v1Router from "./routers/v1/index.router";
import v2Router from "./routers/v2/index.router";
import { startWorkers, stopWorkers } from "./workers";

const app        = express();
const httpServer = createServer(app);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
  origin:         serverConfig.CORS_ORIGIN,
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-correlation-id"],
}));

if (serverConfig.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (msg: string) => logger.http(msg.trim()) },
      skip:   (_req, res) => res.statusCode < 400 && serverConfig.NODE_ENV === "production",
    }),
  );
}

app.use(
  "/api/v1/payment/webhook",
  express.raw({ type: "application/json" }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(attachCorrelationIdMiddleware);

app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), env: serverConfig.NODE_ENV });
});

app.use(appErrorHandler);
app.use(genericErrorHandler);

const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully...`);

  httpServer.close(async () => {
    try {
      await stopWorkers();
      await closeQueues();
      await closeRedisConnections();
      await prisma.$disconnect();
      logger.info("Shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced exit after 30s timeout");
    process.exit(1);
  }, 30_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  process.exit(1);
});

prisma.$connect()
  .then(() => {
    logger.info("Database connected successfully");

    initSocket(httpServer);
    logger.info("Socket.io initialized");

    startWorkers();
    logger.info("BullMQ workers started");

    import("./cron").catch(err => logger.error("[Cron] Failed to load:", err));

    httpServer.listen(serverConfig.PORT, () => {
      logger.info(`🚀 Quby API running on port ${serverConfig.PORT} [${serverConfig.NODE_ENV}]`);
    });
  })
  .catch((err) => {
    logger.error("Failed to connect to database:", err);
    process.exit(1);
  });
