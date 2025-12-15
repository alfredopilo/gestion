import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Gestión Escolar',
      version: '1.0.0',
      description: 'API REST para sistema de gestión escolar',
      contact: {
        name: 'Soporte',
        email: 'info@gestionescolar.edu',
      },
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api/v1`,
        description: 'Servidor de desarrollo',
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
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ============================================
// CORS - DEBE SER EL PRIMER MIDDLEWARE
// ============================================
// Configuración CORS mejorada para manejar archivos multipart/form-data
app.use((req, res, next) => {
  // Permitir todos los orígenes
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  
  // Headers permitidos - incluir todos los necesarios para multipart/form-data
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-institution-id, Content-Disposition'
  );
  
  // Métodos permitidos
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  
  // Permitir credenciales si es necesario
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Exponer headers personalizados si es necesario
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  
  // Manejar solicitudes OPTIONS (preflight) - DEBE responder antes de cualquier otro middleware
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Configuración adicional de CORS con opciones específicas
app.use(cors({
  origin: '*', // Permitir todos los orígenes
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-institution-id',
    'Content-Disposition'
  ],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  maxAge: 86400 // 24 horas para cachear preflight
}));

// Middlewares adicionales
// Helmet configurado para no interferir con CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));

// Middleware condicional para excluir la ruta de backup/upload de express.json()
// porque multer necesita procesar multipart/form-data sin interferencia
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/backup/upload' && req.method === 'POST') {
    // Saltar express.json() para esta ruta, multer lo manejará
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/backup/upload' && req.method === 'POST') {
    // Saltar express.urlencoded() para esta ruta también
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Gestión Escolar API',
  });
});

// API Routes
app.use('/api/v1', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Iniciar servidor
async function startServer() {
  try {
    await connectDB();
    // Escuchar en todas las interfaces de red (0.0.0.0) para permitir conexiones externas
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
      console.log(`📚 Documentación API en http://${HOST}:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();

