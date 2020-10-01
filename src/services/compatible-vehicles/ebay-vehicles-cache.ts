import { HashMaker } from './find-compatibles';
import Axios         from 'axios';

export type EbayVehicle = {
  epid: string;
  make: string;
  model_submodel: string;
  year: string;
  rocky_mountain_vehicle_id: string | null;
  parts_unlimited_vehicle_id: string | null;
  hashes: {
    make: string;
    model: Array<string>;
    year: number;
  }
}

export default class EbayVehiclesCache {

  private vehicles: Array<EbayVehicle> | null = null;

  private isCacheFetching = false;

  private resolvers = [];

  protected async vehiclesProvider() {

    // return JSON.parse(require('fs').readFileSync('ebayVehicles.json', 'utf8'))

    let vehicles = [];

    const limit = 10000;
    let offset  = 0;
    while (true) {
      const { data } = await Axios.get(process.env.CATALOG_HOST + `/api/datastore/EbayCompatibleVehicles?limit(${ limit },${ offset })`);
      if (data.length === 0) break;
      vehicles = vehicles.concat(data);
      offset += limit;
    }
    return vehicles.map(vehicle => this.preformatEbayVehicle(vehicle));
  }

  protected preformatEbayVehicle(vehicle: { epid: string, make: string, model: string, year: string, rocky_mountain_vehicle_id: string | null, parts_unlimited_vehicle_id: string | null }): EbayVehicle {
    return {
      ...vehicle,
      model_submodel: vehicle.model,
      hashes:         {
        make:  HashMaker.rmMake(vehicle.make),
        model: HashMaker.model(vehicle.model),
        year:  +vehicle.year
      }
    };
  }


  async getVehicles(): Promise<Array<EbayVehicle>> {
    if (this.vehicles) {
      return this.vehicles;
    }
    if (this.isCacheFetching) {
      return await new Promise<Array<EbayVehicle>>(resolve => {
        this.resolvers.push(resolve);
      });
    }
    this.resolvers       = [];
    this.isCacheFetching = true;
    const vehicles       = await this.vehiclesProvider();
    this.resolvers.forEach(resolve => resolve(vehicles));
    return this.vehicles = vehicles;
  }

  purgeCache() {
    this.vehicles = null;
  }
}
