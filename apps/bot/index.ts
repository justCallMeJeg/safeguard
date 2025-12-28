import { SafeguardClient } from "./src/structures/SafeguardClient";
import { Logger } from "./src/structures/Logger";

// Create and start the client
const client = new SafeguardClient();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await client.shutdown();
});

process.on("SIGTERM", async () => {
  await client.shutdown();
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  Logger.error("UncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  Logger.error("UnhandledRejection", reason instanceof Error ? reason : new Error(String(reason)));
});

// Start the bot
client.start();
