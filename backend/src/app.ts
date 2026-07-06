import express from 'express';
import cors from 'cors';
import { parkingRoutes } from './routes/parkingRoutes';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import './services/councilAdapters'; // registers all council adapters as a side effect

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/parking', parkingRoutes);

  app.use(errorHandler);

  return app;
}
