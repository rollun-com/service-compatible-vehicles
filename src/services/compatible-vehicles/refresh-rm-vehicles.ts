import { sha256 } from "../../utils/hash";
import { mysql }  from "../../../server";
import cheerio    from 'cheerio';
import fs         from 'fs';
import { wait }   from "rollun-ts-utils/dist";

const RM_VEHICLES_DATA_URL = '/vehdata';
const RM_HOST = 'https://www.rockymountainatvmc.com';

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
	const start = `\u{80}`;
	const end = `\u{10FFF0}`;
	const searchPattern = new RegExp(`[${start}-${end}]`, `g`);
	if (val.split('').some(isDoubleByte)) {
		console.log('unicode!!!', val.split('').find(isDoubleByte));
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
		const id = sha256(Object.values(vehicle).join(''));
		const res = await mysql.query('select * from rm_vehicles where id = ?', [id]) as Array<RMVehicle>;
		if (res.length > 0) {
			return console.log(`Vehicle with id ${id} exists!`);
		}
		console.log(JSON.stringify(vehicle));
		await mysql.query(`
            insert into rm_vehicles
            values (?, ?, ?, ?, ?)
		`, [id, vehicle.type, vehicle.year, vehicle.make, vehicle.model]);
	}
}

export function refreshRMVehicles(axios, logger) {
	return async () => {
		const types = await getVehicleTypes();
		console.log('Got types', types);
		let vehicleCounter = 0;
		for (let i = 0; i < types.length; i++) {
			const type = types[i];
			if (+type.id === 0) continue;
			const years = await getVehicleTypeYears(type.id);
			console.log(`\x1b[32mgot ${years.length} years for type: ${type.id} ${i + 1}/${types.length}\x1b[0m`);
			for (let i = 0; i < years.length; i++) {
				const year = years[i];
				const makes = await getVehicleMakes(type.id, year.id);
				console.log(`\x1b[33mgot ${makes.length} makes for year: ${year.id} ${i + 1}/${years.length}\x1b[0m`);
				for (let i = 0; i < makes.length; i++) {
					const make = makes[i];
					const models = await getVehiclesModels(type.id, year.id, make.id);
					console.log(`got ${models.length} models for make: ${make.id} ${i + 1}/${makes.length}`);
					vehicleCounter += 1;
					await updateVehicles(models.map(model => ({
						type: formatValue(type.name),
						year: formatValue(year.name),
						make: formatValue(make.name),
						model: formatValue(model.name)
					})))
				}
			}
		}
		return vehicleCounter;
	}

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
		})
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
		const $ = cheerio.load(htmlResult.data);
		const container = $('.vehicleType > select > option')
		if (container.length === 0) {
			const fileName = `./data/no_vehicle_types_${new Date().toISOString()}.html`
			fs.writeFileSync(fileName, htmlResult.data);
			logger.error('No vehicle types found, aborting', {fileName})
			throw new Error('No vehiclesTypes found on page');
		}
		const result = [];
		for (let i = 0; i < container.length; i++) {
			const option = container.get(i);
			const id = option.attribs.value;
			const value = option.children[0].data
			result.push({id, name: value});
		}
		return result;
	}

}




