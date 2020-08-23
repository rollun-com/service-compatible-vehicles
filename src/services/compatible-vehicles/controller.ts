import { RequestWithAddons }                   from "../../utils/types";
import { Response }                            from 'express';
import { refreshRMVehicles }                   from "./refresh-rm-vehicles";
import { refreshEbayVehicles }                 from "./refresh-ebay-vehicles";
import { findAllCompatibles, findCompatibles } from "./find-compatibles";

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

export async function findAllCompatiblesController(req: RequestWithAddons, res: Response) {
	if (findCompatiblesProcessRunning) {
		return res.status(500).send({
			ok: false,
			error: 'Process is already running'
		})
	}
	findCompatiblesProcessRunning = true;
	res.send({ok: true});
	try {
		await findAllCompatibles(req.axios, req.logger)();
	} catch (e) {
		console.log(`Error while computing compatible vehicles: ${e}`);
		// return res.status(500).send({
		// 	error: `Error while computing compatible vehicles: ${e}`
		// })
	}
	findCompatiblesProcessRunning = false;
}

export async function findCompatiblesController(req: RequestWithAddons, res: Response) {

	const makeInvalidParamsError = (text: string) => res.status(400).send({error: text})


	try {
		const {make, model, year} = req.query;
		if (!make) return makeInvalidParamsError('`make` is required');
		if (!model) return makeInvalidParamsError('`model` is required');
		if (!year) return makeInvalidParamsError('`year` is required');
		if (isNaN(+year) || +year < 0 || +year > 99999) return ('`year` must be a valid year e.g. - 2001')
		res.send(await findCompatibles(req.axios, req.logger)({make, model, year}));
	} catch (e) {
		req.logger.error(`Error while fining compatible`,);
		console.log(`Error while computing compatible vehicles: ${e}`);
		return res.status(500).send({
			error: `Error while computing compatible vehicles: ${e}`
		})
	}
}
