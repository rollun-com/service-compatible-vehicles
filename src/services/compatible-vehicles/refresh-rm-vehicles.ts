import { sha256 }              from '../../utils/hash';
import { globalLogger, mysql } from '../../../server';
import cheerio                 from 'cheerio';
import fs                      from 'fs';
import { wait }                from 'rollun-ts-utils/dist';
import Axios                   from 'axios';
import { log }                 from 'util';

const RM_VEHICLES_DATA_URL = '/vehdata';
const RM_HOST              = 'https://www.rockymountainatvmc.com';

export interface RMVehicle {
  id: string,
  type: string,
  year: string,
  make: string,
  model: string,
  makeHashCache?: string;
  modelHashCache?: Array<string>;
}


function isDoubleByte(str) {
  for (var i = 0, n = str.length; i < n; i++) {
    if (str.charCodeAt(i) > 255) {
      return true;
    }
  }
  return false;
}

function formatValue(val: string) {
  const start         = `\u{80}`;
  const end           = `\u{10FFF0}`;
  const searchPattern = new RegExp(`[${ start }-${ end }]`, `g`);
  if (val.split('').some(isDoubleByte)) {
    globalLogger.notice('Got unicode char in RM vehicle value', {
      val,
      char: val.split('').find(isDoubleByte)
    });
  }
  return val
    .split('')
    .filter(c => c.charCodeAt(0) < 128)
    .join('')
    .trim()
    // delete unicode characters
    .replace(searchPattern, '');
}

async function updateVehicles(vehicles: Array<RMVehicle>) {
  for (const vehicle of vehicles) {
    const vehicleToInsert = {
      make:  vehicle.make,
      model: vehicle.model,
      year:  vehicle.year
    };

    await Axios.post(process.env.CATALOG_HOST + '/api/datastore/RockyMountainCompatibleVehicles', vehicleToInsert, {
      headers: {
        'If-Match': '*'
      }
    }).catch(err => {
      globalLogger.error('Error while updating RM vehicle', {
        error:    err.message,
        response: err.response && err.response.data,
        vehicle:  vehicleToInsert
      });
    });
  }
}

export function refreshRMVehicles(axios, logger) {
  return async () => {
    const types = await getVehicleTypes();
    logger.debug(`Got vehicles types`, types);
    let vehicleCounter = 0;
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (+type.id === 0) continue;
      await wait(3000)
      const years = await getVehicleTypeYears(type.id);
      logger.debug(`Got ${ years.length } years for type: ${ type.name } ${ i + 1 }/${ types.length }`);
      for (let i = 0; i < years.length; i++) {
        const year  = years[i];
        await wait(3000)
        const makes = await getVehicleMakes(type.id, year.id);
        logger.debug(`Got ${ makes.length } makes for year: ${ year.name } ${ i + 1 }/${ years.length }`);
        for (let i = 0; i < makes.length; i++) {
          const make   = makes[i];
          await wait(3000)
          const models = await getVehiclesModels(type.id, year.id, make.id);
          logger.debug(`Got ${ models.length } models for make: ${ make.name } ${ i + 1 }/${ makes.length }`);
          vehicleCounter += 1;
          await updateVehicles(models.map(model => ({
            type:  formatValue(type.name),
            year:  formatValue(year.name),
            make:  formatValue(make.name),
            model: formatValue(model.name)
          })));
        }
      }
    }
    logger.debug('Refresh RM vehicles end', { vehicleCounter });
    return vehicleCounter;
  };

  async function getVehiclesModels(typeId, yearId, makeId) {
    const vehiclesResult = await axios.get(RM_HOST + RM_VEHICLES_DATA_URL, {
      params: {
        dataType: 'models',
        typeId, yearId, makeId
      }
    });
    return vehiclesResult.data;
  }

  async function getVehicleMakes(typeId, yearId) {
    const makesResult = await axios.get(RM_HOST + RM_VEHICLES_DATA_URL, {
      params: {
        dataType: 'makes',
        typeId, yearId
      }
    });
    return makesResult.data;
  }

  async function getVehicleTypeYears(typeId) {
    const yearsResult = await axios.get(RM_HOST + RM_VEHICLES_DATA_URL, {
      params: {
        dataType: 'years',
        typeId
      }
    });
    return yearsResult.data;
  }

  async function getVehicleTypes() {
    const htmlResult = await axios.get(RM_HOST);
    const $          = cheerio.load(htmlResult.data);
    const container  = $('.vehicleType > select > option');
    if (container.length === 0) {
      const fileName = `./data/no_vehicle_types_${ new Date().toISOString() }.html`;
      fs.writeFileSync(fileName, htmlResult.data);
      logger.error('No vehicle types found, aborting', { fileName });
      throw new Error('No vehiclesTypes found on page');
    }
    const result = [];
    for (let i = 0; i < container.length; i++) {
      const option = container.get(i);
      const id     = option.attribs.value;
      const value  = option.children[0].data;
      result.push({ id, name: value });
    }
    return result;
  }
}




