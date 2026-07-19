import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

/**
 * Helper to retry database operations when facing transient Supabase pooler / PgBouncer or connection churn errors.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 200
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const errCode = err?.code;

      const isTransient =
        ['P1001', 'P1008', 'P1017', 'P2024'].includes(errCode) ||
        errMsg.includes('prepared statement') ||
        errMsg.includes('Connection lost') ||
        errMsg.includes('closed') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('socket');

      if (isTransient && attempt < maxRetries) {
        console.warn(`[DB Retry] Transient DB error (attempt ${attempt}/${maxRetries}): ${errMsg}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
