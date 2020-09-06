import { mysql }     from "../../../server";
import { RMVehicle } from "./refresh-rm-vehicles";

const strcmp = (str1, str2) => ((str1 == str2) ? 0 : ((str1 > str2) ? 1 : -1))

export namespace HashMaker {
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

type CompareModel = {raw: string, hashes: Array<string>};

const compareStrategies = {
	// model match gives 4 points
	compareModel: {
		comparator: (model: CompareModel, ebayModel: CompareModel): {modelMatchScore: number, modelPercentMatch: number} => {
			// check full models strings for match
			const _model = HashMaker.ebayMake(model.raw);
			const _ebayModel = HashMaker.ebayMake(ebayModel.raw);
			if (
				_model.length > 0 && _ebayModel.length > 0 &&
				(_model.includes(_ebayModel) || _ebayModel.includes(_model)) &&
				(Math.min(model.raw.length, ebayModel.raw.length) / Math.max(model.raw.length, ebayModel.raw.length) * 100)
			) {
				return {
					modelMatchScore: 4,
					modelPercentMatch: (Math.min(model.raw.length, ebayModel.raw.length) / Math.max(model.raw.length, ebayModel.raw.length) * 100)
				}
			}

			// if no match, check word by word

			const maxHashLength = Math.max(ebayModel.hashes.length, model.hashes.length);

			const cleanEbayModel = ebayModel.hashes.filter(word => model.hashes.find(rmWord => word.includes(rmWord) || rmWord.includes(word)));
			const maxHash = cleanEbayModel.length > model.hashes.length ? cleanEbayModel : model.hashes;
			let minHash = cleanEbayModel.length > model.hashes.length ? model.hashes : cleanEbayModel;

			// if no match, check word by word
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
			return +rmYear <= +ebayYear ? 1 : 0;
		}
	}
};

const cache = {
	_caches: {},

	async getEbayVehicles() {
		const cacheName = 'ebayVehicles';
		if (this.cacheExists(cacheName)) {
			return this.getCache(cacheName);
		}
		const ebayVehicles = await mysql.query(`select epid,
                                                   make,
                                                   model_submodel,
                                                   year,
                                                   hashes
                                            from ebay_vehicles`) as Array<EbayVehicle>;
		return this.setCache('ebayVehicles', ebayVehicles);
	},

	async getMakesAliases() {
		const cacheName = 'makesAliases';
		if (this.cacheExists(cacheName)) {
			return this.getCache(cacheName);
		}
		const makesAliases = await mysql.query(`select *
                                            from makes_aliases`) as Array<{ebay_brand_id: string, rm_brand_id: string}>;

		return this.setCache('makesAliases', makesAliases)
	},

	setCache(name: string, cache: any) {
		return this._caches[name] = cache
	},
	getCache(name: string): any | null {
		if (this._caches[name] !== undefined) return this._caches[name];
		return null;
	},
	cacheExists(name: string): boolean {
		return this._caches[name] !== undefined;
	},
	deleteCache(name: string) {
		this._caches[name] = undefined;
	},
	deleteAllCaches() {
		this._caches = {};
	}
}

export function resetEbayVehiclesCache() {
	cache.deleteCache('ebayVehicles');
}

export type EbayVehicle = {
	epid: string;
	make: string;
	model_submodel: string;
	year: string;
	hashes: {
		make: string;
		model: Array<string>;
		year: string;
	}
}

export function findCompatibles(axios, logger) {
	return async (vehicle: {make: string, model: string, year: string}): Promise<Array<{epid: string, make: string, model: string, year: string}>> => {
		const ebayVehicles = await cache.getEbayVehicles() as Array<EbayVehicle>;
		const makesAliases = await cache.getMakesAliases() as Array<{ebay_brand_id: string; rm_brand_id: string}>;

		const vehicleMakeHash = HashMaker.rmMake(vehicle.make);
		const vehicleModelHash = HashMaker.model(vehicle.model);
		const compatibles = ebayVehicles
			.filter(({hashes: {make, model, year}, model_submodel}) => {
				const yearScore = compareStrategies.compareYear.comparator(vehicle.year, year);
				const makeScore = compareStrategies.compareMake.comparator(vehicleMakeHash, make, makesAliases);
				const {modelMatchScore, modelPercentMatch} = compareStrategies.compareModel.comparator(
					{raw: model_submodel, hashes: model},
					{raw: vehicle.model, hashes: vehicleModelHash}
				);
				if (yearScore + makeScore + modelMatchScore < 7) return false;
				return modelPercentMatch > 50;
			})
			.map(({make, model_submodel, year, epid}) => ({
				epid, make, model: model_submodel, year
			}));
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
				const {modelMatchScore, modelPercentMatch} = compareStrategies.compareModel.comparator(
					{raw: rmVehicle.model, hashes: rmModelHash},
					{raw: ebayVehicle.model_submodel, hashes: ebayModelHash}
				);
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

