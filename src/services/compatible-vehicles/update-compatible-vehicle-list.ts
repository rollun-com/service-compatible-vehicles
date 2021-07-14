import fs from 'fs';
import axios from 'axios';
import stream from 'stream';
import { promisify } from 'util';
import extract from 'extract-zip';
import csv from 'csvtojson';
import {MONTHS} from './constants';

const finished = promisify(stream.finished);

const csvCompatibleNameToTableNamesMap = {
  ePID: 'epid',
  Make: 'make',
  Model: 'model',
  Model_Submodel: 'model_slim',
  Submodel: 'submodel',
  Year: 'year',
}

const tableNamesToCsvCompatiblesMap = {
  epid: 'ePID',
  make: 'Make',
  model: 'Model',
  model_slim: 'Model_Submodel',
  submodel: 'Submodel',
  year: 'Year',
}

const getInfoFromCsvCompatible = (csvCompatible) => {
  return Object.keys(csvCompatible)
    .filter((key) => csvCompatibleNameToTableNamesMap[key])
    .reduce((acc, curr) =>
        ({ ...acc, [csvCompatibleNameToTableNamesMap[curr]]: csvCompatible[curr] }),
      {})
}

const compare = (csvComp, comp) => {
  return Object.keys(comp).every((key) => comp[key] === csvComp[tableNamesToCsvCompatiblesMap[key]])
}

async function downloadFile(fileUrl, outputLocationPath) {
  const writer = fs.createWriteStream(outputLocationPath, { encoding: 'utf-8' });

  return axios.get(fileUrl, {
    responseType: 'stream',
  }).then(async response => {
    response.data.pipe(writer);
    return finished(writer); //this is a Promise
  });
}

export async function updateCompatibleVehicleList(logger) {
  logger.info('updateCompatibleVehicleList: job started')

  const month = new Date().getMonth() - 1;
  const year = new Date().getFullYear();

  const fileName = `${MONTHS[month]}_${year}_MPSOV`;
  const fileUrl = `https://ir.ebaystatic.com/pictures/aw/pics/motors/compatibility/download/${fileName}.zip`;
  const fsFileNameZip = `${__dirname}/${fileName}.zip`;
  const fsFileNameCsv = `${__dirname}/${fileName}.zip`;

  try {
    await downloadFile(fileUrl, fsFileNameZip);
    await extract(fsFileNameZip, { dir: __dirname })
    const newCompatibles = await csv().fromFile(fsFileNameCsv);
    const { data: oldCompatibles } = await axios.get(
      `${process.env.CATALOG_HOST}/api/datastore/EbayCompatibleVehicles?select(epid,make,model,model_slim,submodel,year)`
    );

    let promises = [];
    const newCompatiblesLength = newCompatibles.length;
    for (const [index, compatible] of newCompatibles.entries()) {
      logger.info(
        `updateCompatibleVehicleList: processing ${index}/${newCompatiblesLength} ${compatible.ePID}`,
        {
          compatible
        }
      )
      const foundCompatible = oldCompatibles.find((oldComp) => oldComp.epid === compatible['ePID'])

      if (!foundCompatible || !compare(compatible, foundCompatible)) {
        const updatedCompatible = {
          ...getInfoFromCsvCompatible(compatible),
          rocky_mountain_vehicle_id: null,
          parts_unlimited_vehicle_id: null,
          tucker_rocky_vehicle_id: null
        }
        logger.info(`updateCompatibleVehicleList: need to be updated ${compatible.ePID}`, {
          compatible,
          updatedCompatible,
          foundCompatible,
        })

        const updateFunction = foundCompatible ? axios.put : axios.post;
        promises.push(
          updateFunction(`${process.env.CATALOG_HOST}/api/datastore/EbayCompatibleVehicles`, updatedCompatible)
        );
        continue;
      }

      logger.info(`updateCompatibleVehicleList: vehicle is found ${compatible.ePID} and not changed`, {
        compatible
      })
    }
  } catch (e) {
    logger.error('updateCompatibleVehicleList: error updating compatibles', {
      message: e.message,
      stack: e.stack,
    })
  } finally {
    await fs.promises.unlink(fsFileNameZip)
    await fs.promises.unlink(fsFileNameCsv)
      .catch((err) =>
        logger.error('updateCompatibleVehicleList: deleting file', {
          message: err.message,
          stack: err.stack,
        }))
  }


  logger.info('updateCompatibleVehicleList: job ended')
}
