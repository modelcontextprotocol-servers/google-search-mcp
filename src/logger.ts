import { pino } from "pino";
import * as path from "path";
import * as fs from "fs";

// Ensure the /tmp directory exists
const logDir = "/tmp";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create log file path
const logFilePath = path.join(logDir, "google-search.log");

// Create pino logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || "info", // Can set log level via environment variable
  transport: {
    targets: [
      // Output to console, using pino-pretty for formatted output
      {
        target: "pino-pretty",
        level: "info",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
      // Output to file – use trace level to capture all logs
      {
        target: "pino/file",
        level: "trace", // Use lowest level to capture all logs
        options: { destination: logFilePath },
      },
    ],
  },
});

// Add handlers for process exit
process.on("exit", () => {
  logger.info("Process exited, logging stopped");
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT signal, logging stopped");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM signal, logging stopped");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  process.exit(1);
});

export default logger;
