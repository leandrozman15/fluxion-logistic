import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

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
app.use('/api/tenants', tenantsRoutes);
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
