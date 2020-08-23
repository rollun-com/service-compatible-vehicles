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
			.replace(/[\s\-\\/;:%$#№@"']+/g, '')
			.toLowerCase();
	};

	export const model = (model: string): Array<string> => {
		return model
			.replace(/[\-\\/;:#$!@()^№+]/g, '')
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
		// .join('');
	}
}

const compareStrategies = {
	// model match gives 4 points
	compareModel: {
		comparator: (rmModel: Array<string>, ebayModel: Array<string>): {modelMatchScore: number, modelPercentMatch: number} => {
			const maxHashLength = Math.max(ebayModel.length, rmModel.length);

			const cleanEbayModel = ebayModel.filter(word => rmModel.find(rmWord => word.includes(rmWord) || rmWord.includes(word)));
			const maxHash = cleanEbayModel.length > rmModel.length ? cleanEbayModel : rmModel;
			let minHash = cleanEbayModel.length > rmModel.length ? rmModel : cleanEbayModel;
			// const maxHashString = maxHash.join('');
			// const minHashString = minHash.join('');

			// const isMatch = minHashString ? maxHashString.includes(minHashString) : false;
			// const isMatch = !!maxHash.some(word => minHash.find(w => w.includes(word) || word.includes(w)));
			const matchPercent = maxHash.reduce((percent, word) => {
				// const similarWord = '';
				let match = 0;
				for (let i = 0; i < minHash.length; i++) {
					const w = minHash[i];
					const maxWord = word.length > w.length ? word : w;
					const minWord = word.length > w.length ? w : word;

					if (maxWord.includes(minWord) && (minWord.length * 100 / maxWord.length) > match) {
						match = minWord.length * 100 / maxWord.length;
						minHash = minHash.filter((_, idx) => i !== idx);
					}
					if (match === 100) break;
				}
				return percent + match / maxHashLength;
			}, 0);
			return {
				modelMatchScore: matchPercent > 0 ? 4 : 0,
				modelPercentMatch: matchPercent
			}
		}
	},
	// make match gives 2 points
	compareMake: {
		comparator: (rmMake, ebayMake, makesAliasesCache) => {
			const makeAlias = makesAliasesCache.find(el => el.ebay_brand_id === ebayMake && el.rm_brand_id === rmMake);
			return (makeAlias || (ebayMake === rmMake)) ? 2 : 0;
		}
	},
	// year match gives 1 point
	compareYear: {
		comparator: (rmYear, ebayYear) => {
			// return Math.abs(ebayYear - rmYear) < 3 ? 1 : 0;
			return ebayYear === rmYear ? 1 : 0;
		}
	}
};

export function findCompatibles(axios, logger) {
	return async (vehicle: {make: string, model: string, year: string}): Promise<Array<{epid: string}>> => {
		logger.debug('find compatible start', {vehicle});
		const ebayVehicles = await mysql.query(`select epid,
                                                   make,
                                                   model_submodel,
                                                   year
                                            from ebay_vehicles`) as Array<{epid: string, make: string, model_submodel: string, year: string}>;
		const makesAliasesCache = await mysql.query(`select *
                                                 from makes_aliases`) as Array<{ebay_brand_id: string, rm_brand_id: string}>;
		const vehicleMakeHash = HashMaker.rmMake(vehicle.make);
		const vehicleModelHash = HashMaker.model(vehicle.model);
		const compatibles = ebayVehicles
			.filter(ebayVehicle => {
				const yearScore = compareStrategies.compareYear.comparator(vehicle.year, ebayVehicle.year);
				const makeScore = compareStrategies.compareMake.comparator(vehicleMakeHash, HashMaker.ebayMake(ebayVehicle.make), makesAliasesCache);
				const {modelMatchScore, modelPercentMatch} = compareStrategies.compareModel.comparator(vehicleModelHash, HashMaker.model(ebayVehicle.model_submodel));
				if (yearScore + makeScore + modelMatchScore < 7) return false;
				return modelPercentMatch > 50;
			})
			.map(ebayVehicle => ({
				...ebayVehicle,
				model: ebayVehicle.model_submodel
			}));
		logger.debug('find compatible end', {vehicle, compatibles});
		return compatibles;
	};
}

// TODO refactor

export function findAllCompatibles(axios, logger) {
	return async () => {
		await mysql.query(`truncate compatible_vehicles`);
		const rmVehiclesCache = await mysql.query(`select *
                                               from rm_vehicles`) as Array<RMVehicle>;
		const makesAliasesCache = await mysql.query(`select *
                                                 from makes_aliases`) as Array<{ebay_brand_id: string, rm_brand_id: string}>;
		const ebayVehiclesCache = await mysql.query(`select *
                                                 from ebay_vehicles`) as Array<EbayVehicle>;
		for (let i = 0; i < ebayVehiclesCache.length; i++) {
			const ebayVehicle = ebayVehiclesCache[i];
			console.log(`Trying to match ${i + 1} ebay item`);
			let matchScore = 0;
			let model_match_percent = 0;
			let compatibleVehicleIdx = -1;
			let hashes = {ebay: '-', rm: '-'};
			const ebayMakeHash = HashMaker.ebayMake(ebayVehicle.make);
			const ebayModelHash = HashMaker.model(ebayVehicle.model_submodel);
			for (let idx = 0; idx < rmVehiclesCache.length; idx++) {
				const rmVehicle = rmVehiclesCache[idx];
				// year
				const yearScore = compareStrategies.compareYear.comparator(rmVehicle.year, ebayVehicle.year);
				// make
				let rmMakeHash = rmVehicle.makeHashCache || (rmVehicle.makeHashCache = HashMaker.rmMake(rmVehicle.make));
				const makeScore = compareStrategies.compareMake.comparator(rmMakeHash, ebayMakeHash, makesAliasesCache);
				// model
				const rmModelHash = rmVehicle.modelHashCache || (rmVehicle.modelHashCache = HashMaker.model(rmVehicle.model));
				const {modelMatchScore, modelPercentMatch} = compareStrategies.compareModel.comparator(rmModelHash, ebayModelHash);
				// check comparing results

				let currentMatchScore = makeScore + modelMatchScore + yearScore;
				if (currentMatchScore > matchScore) {
					// reset modal_match_percent if  modalScore goes up.
					model_match_percent = 0;
				}
				if (currentMatchScore >= matchScore && modelPercentMatch >= model_match_percent) {
					matchScore = currentMatchScore;
					if (modelMatchScore > 0) {
						model_match_percent = modelPercentMatch;
					}
					compatibleVehicleIdx = idx;
					hashes.ebay = `${ebayMakeHash}|${ebayModelHash}|${ebayVehicle.year}`;
					hashes.rm = `${rmMakeHash}|${rmModelHash}|${rmVehicle.year}`;
				}
			}
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
		}
		console.log('done');
		return ebayVehiclesCache.length;
	}
}

