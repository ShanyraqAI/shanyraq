import { PrismaClient } from "@prisma/client";
// Capability/form values must never enter Prisma's invocation/error logger.
const globalDb = globalThis as unknown as { guestStayDb?: PrismaClient };
export const stayDb = globalDb.guestStayDb ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production") globalDb.guestStayDb = stayDb;
