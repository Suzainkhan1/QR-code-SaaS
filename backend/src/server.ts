import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Configurations
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('[CRITICAL ERROR] JWT_SECRET is not configured! Failing fast.');
  process.exit(1);
}

// Imports
import apiRouter from './routes/api.routes';
import { initSocket } from './socket';
import { prisma } from './config/db';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security and Parsers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow displaying local image assets in frontend
}));
const allowedOrigins: string[] = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(...process.env.FRONTEND_URL.split(',').map(url => url.trim()));
}
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Real-time server init
initSocket(server);

// Swagger Documentation Setup
//
// ROOT CAUSE of the previously-empty Swagger page: `apis: []` gave swagger-jsdoc
// nothing to scan, so it always produced `paths: {}` regardless of how many
// routes existed. swagger-jsdoc builds its spec by reading `@openapi` JSDoc
// comments out of the files listed in `apis` — it does not introspect Express
// routers automatically. The routes themselves have now been annotated with
// `@openapi` blocks (see api.routes.ts), and `apis` below is pointed at the
// actual route file so those comments are picked up.
//
// The glob covers both `.ts` (local `ts-node-dev`) and compiled `.js` (Render
// runs `node dist/server.js`, and comments survive compilation because
// tsconfig.json does not set `removeComments`) so docs work in both environments
// without maintaining two configs.
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CrunchOS API',
      version: '1.0.0',
      description: 'API documentation for CrunchOS - Smart QR Restaurant Operating System',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Deployed server' : 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    path.join(__dirname, 'routes/*.ts'),
    path.join(__dirname, 'routes/*.js'),
  ],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Shared DB reachability check, reused by /health, GET /api, and the startup banner
// so all three report a genuinely-verified status rather than a hardcoded string.
const isDatabaseConnected = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

// Root Health Check Route
app.get('/health', async (req: Request, res: Response) => {
  const connected = await isDatabaseConnected();
  if (!connected) {
    return res.status(500).json({ status: 'ERROR', database: 'Disconnected' });
  }
  return res.json({ status: 'OK', database: 'Connected', timestamp: new Date() });
});

// GET /api — API root/info banner.
// Previously unhandled: app.use('/api', apiRouter) has no route for the bare
// '/' path, so a request to exactly `/api` fell through the router untouched
// and was caught by the global 404 handler below, producing
// `{ "error": "API route /api not found" }`. Registering this BEFORE the
// router mount answers `GET /api` directly without ever entering apiRouter,
// and does not affect any `/api/*` route, which the router still handles.
app.get('/api', async (req: Request, res: Response) => {
  const connected = await isDatabaseConnected();
  return res.json({
    success: true,
    name: 'CrunchOS API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'Running',
    database: connected ? 'Connected' : 'Disconnected',
    docs: '/api-docs',
  });
});

// Register Core APIs Router
app.use('/api', apiRouter);

// Global Page Not Found Middleware
app.use((req: Request, res: Response) => {
  return res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]', err);
  return res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start Server
server.listen(PORT, async () => {
  const dbConnected = await isDatabaseConnected();
  const env = process.env.NODE_ENV || 'development';
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;

  console.log('==========================================');
  console.log('CrunchOS Backend');
  console.log(`Environment : ${env}`);
  console.log(`Port        : ${PORT}`);
  console.log(`Database    : ${dbConnected ? 'Connected' : 'DISCONNECTED — check DATABASE_URL'}`);
  console.log(`Swagger     : ${baseUrl}/api-docs`);
  console.log(`Health      : ${baseUrl}/health`);
  console.log(`API         : ${baseUrl}/api`);
  console.log('==========================================');

  if (!dbConnected) {
    console.warn('[Startup Warning] Server is running but the database is unreachable. Requests that hit Prisma will fail until this is resolved.');
  }
});

// Handle DB disconnection on process exit
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('[Prisma] Database connection closed.');
  process.exit(0);
});