import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.js';
import customersRoutes from './routes/customers.js';
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
