import { Router } from 'express';
import { searchParkingHandler } from '../controllers/parkingController';

export const parkingRoutes = Router();

parkingRoutes.get('/search', searchParkingHandler);
