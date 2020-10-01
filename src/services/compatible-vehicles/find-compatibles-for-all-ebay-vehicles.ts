import { ebayVehiclesCache }            from './controller';
import Axios                            from 'axios';
import { compareStrategies, HashMaker } from './find-compatibles';
import { EbayVehicle }                  from './ebay-vehicles-cache';
import { MAKES_ALIASES }                from './constants';
import _                                from 'lodash';
import { globalLogger }                 from '../../../server';

type VendorVehicle = {
  id: string, make: string, model: string, year: string
}

type VendorVehicleFormatted = VendorVehicle & {
  model_hash: Array<string>
}

function preformatVehicle(vehicle: VendorVehicleFormatted) {
  return {
    ...vehicle,
    make:       HashMaker.rmMake(vehicle.make),
    model_hash: HashMaker.model(vehicle.model)
  };
}

async function getAllVehicles(storeName): Promise<Array<VendorVehicleFormatted>> {
  // return JSON.parse(require('fs').readFileSync(storeName, 'utf8'));

  let vehicles = [];

  const limit = 10000;
  let offset  = 0;
  while (true) {
    const { data } = await Axios.get(process.env.CATALOG_HOST + `/api/datastore/${ storeName }?limit(${ limit },${ offset })`);
    if (data.length === 0) break;
    vehicles = vehicles.concat(data);
    offset += limit;
  }
  return vehicles.map(preformatVehicle);
}

function findCompatible(ebayVehicle: EbayVehicle, vehicles: Array<VendorVehicleFormatted>): string | null {
  const compatibleVehicles = vehicles
    .reduce((acc, { id, model, year, make, model_hash }) => {
      const yearScore = compareStrategies.compareYear.comparator(+year, +ebayVehicle.hashes.year);
      const makeScore = compareStrategies.compareMake.comparator(make, ebayVehicle.hashes.make, MAKES_ALIASES);

      const { modelMatchScore, modelPercentMatch } = compareStrategies.compareModel.comparator(
        { raw: model, hashes: model_hash },
        { raw: ebayVehicle.model_submodel, hashes: ebayVehicle.hashes.model }
      );

      if (yearScore + makeScore + modelMatchScore === 7 && modelPercentMatch > 50) {
        return acc.concat({
          id, modelPercentMatch, year
        });
      }
      return acc;
    }, []);
  if (compatibleVehicles.length === 0) {
    return null;
  }

  const years = compatibleVehicles
    .reduce((acc, { year }) => acc.includes(year) ? acc : acc.concat(year), [])
    .sort()
    .reverse();

  const findBestVehicle = (compatibleVehicles, currYear) => {
    const currYearVehicles = compatibleVehicles.filter(({ year }) => year == currYear);
    if (currYearVehicles.length > 0) {
      return currYearVehicles.reduce((acc, vehicle) => {
        if (vehicle.modelPercentMatch > acc.modelPercentMatch) {
          return vehicle;
        }
        return acc;
      });
    }
    return null;
  };

  for (const year of years) {
    const bestVehicle = findBestVehicle(compatibleVehicles, year);
    if (bestVehicle) return bestVehicle.id;
  }

  return null;
}

async function updateCompatible(ebayVehicle: EbayVehicle, rmCompatibleId: string | null, puCompatibleId: string | null) {
  if (!(
    ebayVehicle.parts_unlimited_vehicle_id == puCompatibleId &&
    ebayVehicle.rocky_mountain_vehicle_id == rmCompatibleId
  )) {
    return Axios.put(process.env.CATALOG_HOST + '/api/datastore/EbayCompatibleVehicles', {
        epid: ebayVehicle.epid,
        rocky_mountain_vehicle_id: rmCompatibleId,
        parts_unlimited_vehicle_id: puCompatibleId
      })
      .catch(err => {
        globalLogger.error('Error while updating compatible', {
          message:  err.message,
          response: err.response && err.response.data,
          ebayVehicle,
          rmCompatibleId,
          puCompatibleId
        });
      });
  }
}

export function findCompatiblesForAllEbayVehicles(logger) {
  return async () => {
    logger.debug('Fetching ebay vehicles...');
    const ebayVehicles = await ebayVehiclesCache.getVehicles();
    logger.debug('Fetched ebay vehicles...', { amount: ebayVehicles.length });
    logger.debug('Fetching RM vehicles...');
    const rmVehicles = await getAllVehicles('RockyMountainCompatibleVehicles');
    logger.debug('Fetched RM vehicles...', { amount: rmVehicles.length });
    logger.debug('Fetching PU vehicles...');
    const puVehicles = await getAllVehicles('PartUnlimitedCompatibleVehicles');
    logger.debug('Fetched PU vehicles...', { amount: puVehicles.length });

    // const fs = require('fs');
    // fs.writeFileSync('ebayVehicles.json', JSON.stringify(ebayVehicles));
    // fs.writeFileSync('PartUnlimitedCompatibleVehicles', JSON.stringify(puVehicles));
    // fs.writeFileSync('puVehicles.json', JSON.stringify(puVehicles));

    let noMatchRm = 0;
    let noMatchPU = 0;
    for (let i = 0, len = ebayVehicles.length; i < len; i++) {
      const ebayVehicle    = ebayVehicles[i];
      const rmCompatibleId = findCompatible(ebayVehicle, rmVehicles);
      const puCompatibleId = findCompatible(ebayVehicle, puVehicles);
      rmCompatibleId === null && (noMatchRm += 1);
      puCompatibleId === null && (noMatchPU += 1);
      logger.debug(
        ebayVehicle.epid,
        { progress: `${ i + 1 }/${ len }`, rmCompatibleId, puCompatibleId }
      );
      await updateCompatible(ebayVehicle, rmCompatibleId, puCompatibleId);
    }
    logger.debug('Matching finished', {
      totalEbayVehicles: ebayVehicles.length,
      noMatchRm,
      noMatchPU
    });
  };
}
