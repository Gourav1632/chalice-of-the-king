import type { Socket } from "socket.io";
import logger from "../utils/logger";

export function createErrorHandler() {
  return (socket: Socket, next: (err?: Error) => void) => {
    socket.on("error", (err: Error) => {
      const errorData = (err as { data?: { code: string; retryAfterMs: number } }).data;
      
      if (errorData?.code === "RATE_LIMITED") {
        logger.warn(`Rate limit exceeded for socket ${socket.id} - Retry after ${errorData.retryAfterMs}ms`);
      } else {
        logger.error(`Socket error for ${socket.id}:`, err);
      }
    });
    
    next();
  };
}

export function wrapSocketHandler(
  handler: (...args: any[]) => void | Promise<void>,
  eventName: string
): (...args: any[]) => Promise<void> {
  return async (...args: any[]) => {
    try {
      await handler(...args);
    } catch (error) {
      const socket = args[args.length - 1] as Socket;
      logger.error(`Error in ${eventName} handler:`, error);
      socket.emit("error", {
        message: "An error occurred processing your request.",
        code: "HANDLER_ERROR",
      });
    }
  };
}
