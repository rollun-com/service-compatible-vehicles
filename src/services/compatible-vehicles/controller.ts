import { RequestWithAddons }                 from '../../utils/types';
import { Response }                          from 'express';
import { findCompatibles }                   from './find-compatibles';
import { findCompatiblesForAllEbayVehicles } from './find-compatibles-for-all-ebay-vehicles';
import EbayVehiclesCache                     from './ebay-vehicles-cache';
import { refreshRMVehicles }                 from './refresh-rm-vehicles';
import { globalLogger }                      from '../../../server';
import { updateCompatibleVehicleList }       from './update-compatible-vehicle-list';

export const ebayVehiclesCache = new EbayVehiclesCache();

let refreshRockyMountainVehiclesProcessRunning = false;

export async function refreshRockyMountainVehiclesController(req: RequestWithAddons, res: Response) {
  if (refreshRockyMountainVehiclesProcessRunning) {
    return res.status(503).send({
      ok:    false,
      error: 'Process is already running'
    });
  }
  refreshRockyMountainVehiclesProcessRunning = true;
  res.send({ ok: true });
  try {
    await refreshRMVehicles(req.axios, req.logger)();
  } catch (e) {
    globalLogger.error('Error while refreshing RM vehicles', {
      err: e.message
    })
  }
  refreshRockyMountainVehiclesProcessRunning = false;
}

// let refreshEbayVehiclesProcessRunning = false;

// export async function refreshEbayVehiclesController(req: RequestWithAddons, res: Response) {
//   if (refreshEbayVehiclesProcessRunning) {
//     return res.status(500).send({
//       ok:    false,
//       error: 'Process is already running'
//     });
//   }
//   refreshEbayVehiclesProcessRunning = true;
//   res.send({ ok: true });
//   try {
//     await refreshEbayVehicles(req.axios, req.logger)();
//     resetEbayVehiclesCache();
//   } catch (e) {
//     console.log(`Error while refreshing Ebay vehicles: ${ e }`);
//     // return res.status(500).send({
//     // 	error: `Error while refreshing Ebay vehicles: ${e}`
//     // })
//   }
//   refreshEbayVehiclesProcessRunning = false;
// }

// let findCompatiblesProcessRunning = false;
//
// export async function findAllCompatiblesController(req: RequestWithAddons, res: Response) {
//   if (findCompatiblesProcessRunning) {
//     return res.status(500).send({
//       ok:    false,
//       error: 'Process is already running'
//     });
//   }
//   findCompatiblesProcessRunning = true;
//   res.send({ ok: true });
//   try {
//     await findAllCompatibles(req.axios, req.logger)();
//   } catch (e) {
//     console.log(`Error while computing compatible vehicles: ${ e }`);
//     // return res.status(500).send({
//     // 	error: `Error while computing compatible vehicles: ${e}`
//     // })
//   }
//   findCompatiblesProcessRunning = false;
// }

export async function findCompatiblesBulkController(req: RequestWithAddons, res: Response) {
  const makeInvalidParamsError = (text: string) => {
    res.status(400).send({ error: text });
    return true;
  };

  try {
    const vehicles = req.body;
    if (!Array.isArray(vehicles)) return makeInvalidParamsError(`body must be an array of vehicles.`);
    const isValid = !vehicles.find(({ make, model, year }, idx) => {
      if (!make) return makeInvalidParamsError(`#${ idx } 'make' is required`);
      if (!model) return makeInvalidParamsError(`#${ idx } 'model' is required`);
      if (!year) return makeInvalidParamsError(`'#${ idx } 'year' is required`);
      if (isNaN(+year) || +year < 0 || +year > 99999) return (`#${ idx } 'year' must be a valid year e.g. - 2001`);
      return false;
    });
    if (!isValid) return;
    let result = [];
    for (const { make, model, year } of vehicles) {
      result = result
        .concat((await findCompatibles({
            make,
            model,
            year
          }, await ebayVehiclesCache.getVehicles()))
          .filter(({ epid }) => !result.find(({ epid: _epid }) => _epid === epid))
        );
      // remove same epids
    }
    // const result: Array<Array<{epid: string, make: string, model: string, year: string}>> = await Promise.all(vehicles.map(({make, model, year}) => ))
    res.send(result);
  } catch (e) {
    req.logger.error(`Error while fining compatible`, { body: req.body });
    console.log(`Error while computing compatible vehicles: ${ e }`);
    return res.status(500).send({
      error: `Error while computing compatible vehicles: ${ e }`
    });
  }
}

export async function findCompatiblesController(req: RequestWithAddons, res: Response) {

  const makeInvalidParamsError = (text: string) => res.status(400).send({ error: text });

  try {
    const { make, model, year } = req.query as Record<string, string>;
    if (!make) return makeInvalidParamsError('`make` is required');
    if (!model) return makeInvalidParamsError('`model` is required');
    if (!year) return makeInvalidParamsError('`year` is required');
    if (isNaN(+year) || +year < 0 || +year > 99999) return ('`year` must be a valid year e.g. - 2001');
    res.send(await findCompatibles({ make, model, year }, await ebayVehiclesCache.getVehicles()));
  } catch (e) {
    req.logger.error(`Error while fining compatible`, req.query);
    console.log(`Error while computing compatible vehicles: ${ e }`);
    return res.status(500).send({
      error: `Error while computing compatible vehicles: ${ e }`
    });
  }
}

let inProgress = false;

export async function findCompatiblesForAllEbayVehiclesController(req: RequestWithAddons, res: Response) {
  if (inProgress) {
    return res.status(503).send({ error: 'Process is already running' });
  }
  res.send({ ok: true });
  inProgress = true;
  findCompatiblesForAllEbayVehicles(req.logger)()
    .catch(err => {
      req.logger.error(`Global error while finding compatibles for ebay`, {
        message: err.message,
        stack:   err.stack
      });
    })
    .finally(() => inProgress = false);
}

let updatingProcessIsInProgress = false;

export async function updateCompatibleVehicleListController(req: RequestWithAddons, res: Response) {
  if (updatingProcessIsInProgress) {
    return res.status(503).send({ error: 'Process is already running' });
  }

  res.send({ ok: true });
  updatingProcessIsInProgress = true;
  updateCompatibleVehicleList(req.logger)
    .catch(err => {
      req.logger.error(`UpdateCompatibleVehicleList: Error`, {
        message: err.message,
        stack:   err.stack,
      });
    })
    .finally(() => updatingProcessIsInProgress = false);
}
