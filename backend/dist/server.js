"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
// Configurations
dotenv_1.default.config();
if (!process.env.JWT_SECRET) {
    console.error('[CRITICAL ERROR] JWT_SECRET is not configured! Failing fast.');
    process.exit(1);
}
// Imports
const api_routes_1 = __importDefault(require("./routes/api.routes"));
const socket_1 = require("./socket");
const db_1 = require("./config/db");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
// Security and Parsers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false, // Allow displaying local image assets in frontend
}));
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Real-time server init
(0, socket_1.initSocket)(server);
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
const swaggerDocs = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocs));
// Root Health Check Route
app.get('/health', async (req, res) => {
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        return res.json({ status: 'OK', database: 'Connected', timestamp: new Date() });
    }
    catch (error) {
        return res.status(500).json({ status: 'ERROR', database: 'Disconnected', error });
    }
});
// Register Core APIs Router
app.use('/api', api_routes_1.default);
// Global Page Not Found Middleware
app.use((req, res) => {
    return res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});
// Global Error Handler Middleware
app.use((err, req, res, next) => {
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
    await db_1.prisma.$disconnect();
    console.log('[Prisma] Database connection closed.');
    process.exit(0);
});
