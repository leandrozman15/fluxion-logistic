import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health.js';
import customersRoutes from './routes/customers.js';
import tenantsRoutes from './routes/tenants.js';
import usersRoutes from './routes/users.js';
import clientsRoutes from './routes/clients.js';
import driversRoutes from './routes/drivers.js';
import trucksRoutes from './routes/trucks.js';
import loadsRoutes from './routes/loads.js';
import productsRoutes from './routes/products.js';
import quotationsRoutes from './routes/quotations.js';
import analyticsRoutes from './routes/analytics.js';
import { prisma } from './lib/prisma.js';
import { requireApiToken, requireTenantAdmin } from './middlewares/security.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
        return;
      }

      callback(new Error('CORS blocked: CORS_ORIGINS is not configured for production'));
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS blocked: origin not allowed'));
  },
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later' },
});

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter, requireApiToken);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', detail: (error as Error).message });
  }
});

app.use('/api/health', healthRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/tenants', requireTenantAdmin, tenantsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/loads', loadsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Fluxion Logistic backend is running' });
});

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close();
});
