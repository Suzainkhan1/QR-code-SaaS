import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
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
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Real-time server init
initSocket(server);

// Swagger Documentation Setup
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
        url: `http://localhost:${PORT}`,
        description: 'Local development server',
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
  },
  apis: [], // We can specify routes file, or let swaggerUi render a static specification.
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Root Health Check Route
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'OK', database: 'Connected', timestamp: new Date() });
  } catch (error) {
    return res.status(500).json({ status: 'ERROR', database: 'Disconnected', error });
  }
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
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` CrunchOS Backend Server Running on Port ${PORT}`);
  console.log(` REST API Base: http://localhost:${PORT}/api`);
  console.log(` Swagger Docs Available: http://localhost:${PORT}/api-docs`);
  console.log(` Health Check: http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});

// Handle DB disconnection on process exit
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('[Prisma] Database connection closed.');
  process.exit(0);
});
