import { mysql }       from "../../../server";
import { RMVehicle }   from "./refresh-rm-vehicles";
import { EbayVehicle } from "./refresh-ebay-vehicles";
import { Hash }        from "crypto";

namespace HashMaker {
	export const rmMake = (make: string) => {
		return make
			.replace(/\s+/g, '')
			.toLowerCase()
	};
	export const rmModel = (model: string) => {
		return model
			.replace(/\s+/g, '')
			.toLowerCase()
	};

	export const ebayMake = (make: string) => {
		return make
			.replace(/\s+/g, '')
			.toLowerCase();
	};
	export const ebayModel = (model: string) => {
		return model
			.replace(/\s+/g, '')
			.toLowerCase()
	};
}

export function findCompatibles(axios, logger) {
	return async () => {
		let count = 0;
		let offset = 0;
		await mysql.query(`truncate compatible_vehicles`);
		const rmVehiclesCache = await mysql.query(`select *
                                                   from rm_vehicles`) as Array<RMVehicle>;
		const makesAliasesCache = await mysql.query(`select *
                                                     from makes_aliases`) as Array<{ebay_brand_id: string, rm_brand_id: string}>;
		while (true) {
			const [ebayVehicle] = await mysql.query(`select *
                                                     from ebay_vehicles
                                                     limit 1 offset ?`, [offset]) as Array<EbayVehicle>;
			console.log(`Trying to match ${offset + 1} ebay item`);
			if (!ebayVehicle) break;
			let matchScore = -1;
			let compatibleVehicleIdx = -1;
			let hashes = {
				ebay: '-',
				rm: '-'
			};
			rmVehiclesCache.forEach((rmVehicle, idx) => {
				const ebayMakeHash = HashMaker.ebayMake(ebayVehicle.make);
				let rmMakeHash = HashMaker.rmMake(rmVehicle.make);
				const makeAlias = makesAliasesCache.find(el => el.ebay_brand_id === ebayMakeHash && el.rm_brand_id === rmMakeHash);
				const makeScore = (makeAlias || ebayMakeHash === rmMakeHash) ? 4 : 0;
				const ebayModelHash = HashMaker.ebayModel(ebayVehicle.model_submodel);
				const rmModelHash = HashMaker.rmModel(rmVehicle.model);
				const modelScore = ebayModelHash.includes(rmModelHash) ? 2 : 0;
				if (makeScore + modelScore > matchScore) {
					matchScore = makeScore + modelScore;
					compatibleVehicleIdx = idx;
					hashes.ebay = `${ebayMakeHash}|${ebayModelHash}`;
					hashes.rm = `${rmMakeHash}|${rmModelHash}`;
				}
			})
			if (compatibleVehicleIdx > -1) {
				const compatibleVehicle = rmVehiclesCache[compatibleVehicleIdx];
				const [vehicle] = await mysql.query(`select *
                                                     from compatible_vehicles
                                                     where epid = ?`, [ebayVehicle.epid]) as Array<{match_score: number}>;
				if (!vehicle || matchScore > +vehicle.match_score) {
					await mysql.query(`
                        insert into compatible_vehicles
                        values (?, ?, ?, ?, ?)
                        on duplicate key update rm_vehicle_id = ?,
                                                match_score   = ?`, [
						ebayVehicle.epid, compatibleVehicle.id, matchScore, hashes.ebay, hashes.rm, compatibleVehicle.id, matchScore
					]);
				}
				console.log('\x1b[32got match\x1b[0m');
			} else {
				// await mysql.query(`insert ignore into uncompatible_vehicles
				//                    values (?)`, [ebayVehicle.epid]);
				// console.log('\x1b[33mno match\x1b[0m');
			}
			offset += 1;
		}
		console.log('done');
		return count;
	}
}

