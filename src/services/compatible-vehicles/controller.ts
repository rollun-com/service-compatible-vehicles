import { RequestWithAddons }   from "../../utils/types";
import { Response }            from 'express';
import { refreshRMVehicles }   from "./refresh-rm-vehicles";
import { refreshEbayVehicles } from "./refresh-ebay-vehicles";
import { findCompatibles }     from "./find-compatibles";

let refreshRockyMountainVehiclesProcessRunning = false;

export async function refreshRockyMountainVehiclesController(req: RequestWithAddons, res: Response) {
	if (refreshRockyMountainVehiclesProcessRunning) {
		return res.status(500).send({
			ok: false,
			error: 'Process is already running'
		})
	}
	refreshRockyMountainVehiclesProcessRunning = true;
	res.send({ok: true});
	try {
		await refreshRMVehicles(req.axios, req.logger)();
	} catch (e) {
		console.log(`Error while refreshing RM vehicles: ${e}`);
		// return res.status(500).send({
		// 	error: `Error while refreshing RM vehicles: ${e}`
		// })
	}
	refreshRockyMountainVehiclesProcessRunning = false;
}

let refreshEbayVehiclesProcessRunning = false;

export async function refreshEbayVehiclesController(req: RequestWithAddons, res: Response) {
	if (refreshEbayVehiclesProcessRunning) {
		return res.status(500).send({
			ok: false,
			error: 'Process is already running'
		})
	}
	refreshEbayVehiclesProcessRunning = true;
	res.send({ok: true});
	try {
		await refreshEbayVehicles(req.axios, req.logger)();
	} catch (e) {
		console.log(`Error while refreshing Ebay vehicles: ${e}`);
		// return res.status(500).send({
		// 	error: `Error while refreshing Ebay vehicles: ${e}`
		// })
	}
	refreshEbayVehiclesProcessRunning = false;
}

let findCompatiblesProcessRunning = false

export async function findCompatiblesController(req: RequestWithAddons, res: Response) {
	if (findCompatiblesProcessRunning) {
		return res.status(500).send({
			ok: false,
			error: 'Process is already running'
		})
	}
	findCompatiblesProcessRunning = true;
	res.send({ok: true});
	try {
		await findCompatibles(req.axios, req.logger)();
	} catch (e) {
		console.log(`Error while computing compatible vehicles: ${e}`);
		// return res.status(500).send({
		// 	error: `Error while computing compatible vehicles: ${e}`
		// })
	}
	findCompatiblesProcessRunning = false;
}
