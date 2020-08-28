import fs            from 'fs';
import { mysql }     from "../../../server";
import { HashMaker } from "./find-compatibles";

const readline = require('readline');

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
			// precalculated  'hashes'  for ebay vehicles
			const hashes = {
				make: HashMaker.rmMake(make),
				model: HashMaker.model(model_submodel),
				year: year.trim()
			}
			console.log(`epid ${epid} count ${count}`);
			await mysql.query(`
          insert into ebay_vehicles
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          on duplicate key update make           = ?,
                                  model          = ?,
                                  model_submodel = ?,
                                  submodel       = ?,
                                  year           = ?,
                                  vehicle_type   = ?,
                                  moto_type      = ?,
                                  hashes         = ?`, [
				epid, make, model, model_submodel, submodel, year, vehicle_type, moto_type, JSON.stringify(hashes),
				make, model, model_submodel, submodel, year, vehicle_type, moto_type, JSON.stringify(hashes)
			])
		}
		console.log('Done!', count)
		return count;
	};
}
