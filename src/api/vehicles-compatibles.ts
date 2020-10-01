import { Router } from 'express';
import {
  findCompatiblesBulkController,
  findCompatiblesController, findCompatiblesForAllEbayVehiclesController, refreshRockyMountainVehiclesController
  // refreshEbayVehiclesController,
  // refreshRockyMountainVehiclesController
}                 from '../services/compatible-vehicles/controller';

const router = Router();

/**
 * @swagger
 * /api/v1/RefreshRockyMountainVehicles:
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: Parse Vehicles from Rocky Mountain from scratch, and save to 'catalog'
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           $ref: "#/definitions/OKResponse"
 *       503:
 *         description: Process is already running
 *         schema:
 *           $ref: "#/definitions/Error"
 */

router.post('/api/v1/RefreshRockyMountainVehicles', refreshRockyMountainVehiclesController);
// /**
//  * @swagger
//  * /api/v1/RefreshEbayVehicles:
//  *   post:
//  *     tags:
//  *       - "/api/v1"
//  *     description: Get vehicles from ebay from scratch. For now vehicles hardcoded as file.
//  *     responses:
//  *       200:
//  *         description: OK
//  *         schema:
//  *           $ref: "#/definitions/OKResponse"
//  */
//
// router.post('/api/v1/RefreshEbayVehicles', refreshEbayVehiclesController);

// /**
//  * @swagger
//  * /api/v1/FindAllCompatibles:
//  *   post:
//  *     tags:
//  *       - "/api/v1"
//  *     description: Compute compatibles between all ebay vehicles and all Rocky Mountain vehicles. POST - because webhooks can send only POST
//  *     responses:
//  *       200:
//  *         description: OK
//  *         schema:
//  *           $ref: "#/definitions/OKResponse"
//  */
//
// router.post('/api/v1/FindAllCompatibles', findAllCompatiblesController);

/**
 * @swagger
 * /api/v1/FindCompatibles:
 *   get:
 *     tags:
 *       - "/api/v1"
 *     description: Finds compatible vehicles in ebay for passed vehicle
 *     parameters:
 *       - in: query
 *         name: make
 *         schema:
 *           type: string
 *           example: honda
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *           example: NC700X
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *           example: 2017
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: array
 *           items:
 *             $ref: "#/definitions/Compatible"
 *       400:
 *         description: Validation error
 *         schema:
 *           $ref: "#/definitions/Error"
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: Bulk variant for GET /api/v1/FindCompatibles. Converts passed array of vehicles to compatible ebay vehicles
 *     parameters:
 *       -  in: body
 *          name: body
 *          schema:
 *            type: array
 *            items:
 *              $ref: "#/definitions/Vehicle"
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: array
 *           items:
 *             $ref: "#/definitions/Compatible"
 *       400:
 *         description: Validation error
 *         schema:
 *           $ref: "#/definitions/Error"
 */

router.get('/api/v1/FindCompatibles', findCompatiblesController);
router.post('/api/v1/FindCompatibles', findCompatiblesBulkController);

/**
 * @swagger
 * /api/v1/FindAllCompatiblesForEbay:
 *   post:
 *     tags:
 *       - "/api/v1"
 *     description: This method goes through all EbayCompatibleVehicles table, and find match for vehicles from RM and PU
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: array
 *           items:
 *             $ref: "#/definitions/OKResponse"
 *       400:
 *         description: Validation error
 *         schema:
 *           $ref: "#/definitions/Error"
 */


router.post('/api/v1/FindAllCompatiblesForEbay', findCompatiblesForAllEbayVehiclesController);


export default router;
