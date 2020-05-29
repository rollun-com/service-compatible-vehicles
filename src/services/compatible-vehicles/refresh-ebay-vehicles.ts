import fs        from 'fs';
import { mysql } from "../../../server";

const readline = require('readline');

export interface EbayVehicle {
	epid: string;
	make: string;
	model: string;
	model_submodel: string;
	submodel: string;
	start_year: string;
	end_year: string;
	vehicle_type: string;
	moto_type: string;
}

export function refreshEbayVehicles(axios, logger) {
	return async () => {
		const fileStream = fs.createReadStream('ebay_compatibles.csv', 'utf8');
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		})
		let count = 0;
		for await (const line of rl) {
			count += 1;
			// skip header
			if (count === 1) continue;
			const [epid, make, model, model_submodel, submodel, year, vehicle_type, moto_type] = line.split(',').map(s => s.trim());
			console.log(`epid ${epid} count ${count}`);
			const [vehicle] = await mysql.query(`select *
                                                 from ebay_vehicles
                                                 where make = ?
                                                   and model_submodel = ?`, [make, model_submodel]) as Array<EbayVehicle>;
			if (vehicle) {
				const startYear = +vehicle.start_year > +year ? year : vehicle.start_year;
				const endYear = +vehicle.end_year < +year ? year : vehicle.end_year;
				await mysql.query(`update ebay_vehicles
                                   set make           = ?,
                                       model          = ?,
                                       model_submodel = ?,
                                       submodel       = ?,
                                       start_year     = ?,
                                       end_year       = ?,
                                       vehicle_type   = ?,
                                       moto_type      = ?
                                   where epid = ?`, [
					make, model, model_submodel, submodel, startYear, endYear, vehicle_type, moto_type, vehicle.epid
				]);
			} else {
				await mysql.query(`insert into ebay_vehicles
                                   values (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
					epid, make, model, model_submodel, submodel, year, year, vehicle_type, moto_type
				])
			}
		}
		console.log('Done!', count)
		return count;
	};
}
