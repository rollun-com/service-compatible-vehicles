import { Router } from "express";
import {
	findCompatiblesController,
	refreshEbayVehiclesController,
	refreshRockyMountainVehiclesController
}                 from "../services/compatible-vehicles/controller";

const router = Router();

router.post('/api/v1/RefreshRockyMountainVehicles', refreshRockyMountainVehiclesController)
router.post('/api/v1/RefreshEbayVehicles', refreshEbayVehiclesController);
router.post('/api/v1/FindCompatibles', findCompatiblesController);

export default router;
