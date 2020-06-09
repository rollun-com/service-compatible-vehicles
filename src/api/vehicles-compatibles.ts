import { Router } from "express";
import {
	findCompatiblesController,
	refreshEbayVehiclesController,
	refreshRockyMountainVehiclesController
}                 from "../services/compatible-vehicles/controller";

const router = Router();

/**
 * @swagger
 * /api/v1/RefreshRockyMountainVehicles:
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: Parse Vehicles from Rocky Mountain from scratch
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           $ref: "#/definitions/OKResponse"
 */

router.post('/api/v1/RefreshRockyMountainVehicles', refreshRockyMountainVehiclesController);
/**
 * @swagger
 * /api/v1/RefreshEbayVehicles:
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: Get vehicles from ebay from scratch. For now vehicles hardcoded as file.
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           $ref: "#/definitions/OKResponse"
 */

router.post('/api/v1/RefreshEbayVehicles', refreshEbayVehiclesController);

/**
 * @swagger
 * /api/v1/FindCompatibles:
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: Compute compatibles between ebay and Rocky Mountain vehicles.
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           $ref: "#/definitions/OKResponse"
 */

router.post('/api/v1/FindCompatibles', findCompatiblesController);

export default router;
