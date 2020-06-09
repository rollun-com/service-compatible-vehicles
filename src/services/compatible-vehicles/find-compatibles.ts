import { mysql }       from "../../../server";
import { RMVehicle }   from "./refresh-rm-vehicles";
import { EbayVehicle } from "./refresh-ebay-vehicles";
import { Hash }        from "crypto";

const strcmp = (str1, str2) => ((str1 == str2) ? 0 : ((str1 > str2) ? 1 : -1))

namespace HashMaker {
	export const rmMake = (make: string) => {
		return make
			.replace(/\s+/g, '')
			.replace(/-/g, '')
			.toLowerCase()
	};

	export const ebayMake = (make: string) => {
		return make
			.replace(/[\s\-]+/g, '')
			.toLowerCase();
	};

	export const model = (model: string) => {
		return model
			.replace(/[\-\\/%.,;:#№]/g, '')
			.toLowerCase()
			.split(/\s+/)
			.sort((a, b) => {
				// move string started with numbers to the end
				if (/[0-9]/.test(a[0]) || /[0-9]/.test(b[0])) {
					if (/[a-z]/i.test(a[0])) return -1;
					if (/[a-z]/i.test(b[0])) return 1;
				}
				return strcmp(a, b);
			})
			.join('');
	}
}

const compareStrategies = {
	compareModel: {
		comparator: (rmModel, ebayModel) => {
			return (ebayModel.includes(rmModel) || rmModel.includes(ebayModel)) ? 2 : 0;
		}
	},
	compareMake: {
		comparator: (rmMake, ebayMake, makesAliasesCache) => {
			const makeAlias = makesAliasesCache.find(el => el.ebay_brand_id === ebayMake && el.rm_brand_id === rmMake);
			return (makeAlias || (ebayMake === rmMake)) ? 4 : 0;
		}
	},
	compareYear: {
		comparator: (rmYear, ebayYear) => {
			return ebayYear === rmYear ? 1 : 0;
		}
	},
	modelMatchPercent: {
		comparator: (rmModel, ebayModel) => {
			return rmModel.length > ebayModel.length
				? ebayModel.length * 100 / rmModel.length
				: rmModel.length * 100 / ebayModel.length;
		}
	}
};

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
			let model_match_percent = 0;
			let compatibleVehicleIdx = -1;
			let hashes = {
				ebay: '-',
				rm: '-'
			};
			const ebayMakeHash = HashMaker.ebayMake(ebayVehicle.make);
			// const ebayModelHash = HashMaker.ebayModel(ebayVehicle.model_submodel);
			const ebayModelHash = HashMaker.model(ebayVehicle.model_submodel);
			rmVehiclesCache.forEach((rmVehicle, idx) => {
				// year
				const yearScore = compareStrategies.compareYear.comparator(rmVehicle.year, ebayVehicle.year);
				// make
				let rmMakeHash = rmVehicle.makeHashCache || (rmVehicle.makeHashCache = HashMaker.rmMake(rmVehicle.make));
				const makeScore = compareStrategies.compareMake.comparator(rmMakeHash, ebayMakeHash, makesAliasesCache);
				// model
				const rmModelHash = rmVehicle.modelHashCache || (rmVehicle.modelHashCache = HashMaker.model(rmVehicle.model));
				const modelScore = compareStrategies.compareModel.comparator(rmModelHash, ebayModelHash);

				// check comparing results
				let currentMatchScore= makeScore + modelScore + yearScore;
				if (currentMatchScore > matchScore) {
					matchScore = currentMatchScore;
					if (modelScore > 0) {
						model_match_percent = compareStrategies.modelMatchPercent.comparator(rmModelHash, ebayModelHash)
					}
					compatibleVehicleIdx = idx;
					hashes.ebay = `${ebayMakeHash}|${ebayModelHash}|${ebayVehicle.year}`;
					hashes.rm = `${rmMakeHash}|${rmModelHash}|${rmVehicle.year}`;
				}
			})
			if (compatibleVehicleIdx > -1) {
				const compatibleVehicle = rmVehiclesCache[compatibleVehicleIdx];
				const [vehicle] = await mysql.query(`select *
                                                     from compatible_vehicles
                                                     where epid = ?`, [ebayVehicle.epid]) as Array<{match_score: number}>;
				if (!vehicle || (matchScore > +vehicle.match_score)) {
					await mysql.query(`
                        insert into compatible_vehicles
                        values (?, ?, ?, ?, ?, ?)
                        on duplicate key update rm_vehicle_id       = ?,
                                                match_score         = ?,
                                                model_match_percent = ?`, [
						ebayVehicle.epid, compatibleVehicle.id, matchScore, hashes.ebay, hashes.rm, model_match_percent.toFixed(2),
						compatibleVehicle.id, matchScore, model_match_percent.toFixed(2)
					]);
				}
			}
			model_match_percent = 0;
			matchScore = 0;
			offset += 1;
		}
		console.log('done');
		return count;
	}
}

