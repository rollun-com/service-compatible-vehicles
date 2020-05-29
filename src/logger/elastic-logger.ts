import UDPClient from "./udp_request";

export enum LOG_LEVELS {
	INFO = 'info',
	DEBUG = 'debug',
	WARNING = 'warning',
	ERROR = 'error',
	NOTICE = 'notice'
}

interface ElasticLoggerOpts {
	index_name: string,
	host: string,
	port: number,
	lifecycle_token?: string,
	parent_lifecycle_token?: string
}

export type LogContext = string | Object | Array<any> | null | undefined;

export default class ElasticLogger {
	readonly index_name: string;

	private readonly udp_client: UDPClient;
	private local_log_warning_printed = false;

	readonly lifecycle_token: string;
	readonly parent_lifecycle_token: string;

	constructor(opts: ElasticLoggerOpts) {
		this.index_name = opts.index_name;
		this.lifecycle_token = opts.lifecycle_token;
		this.parent_lifecycle_token = opts.parent_lifecycle_token;
		this.udp_client = new UDPClient(opts.host, opts.port);
	}

	private async _logProduction(log_level: LOG_LEVELS, message: string, context?: LogContext) {

		try {
			// log to logstash via udp
			await this.udp_client.send({
				_index_name: this.index_name,
				level: log_level,
				message,
				context: context ? JSON.stringify(context) : null,
				timestamp: (new Date()).toISOString(),
				lifecycle_token: this.lifecycle_token || null,
				parent_lifecycle_token: this.parent_lifecycle_token || null
			});
		} catch (err) {
			console.error(`Couldn't log [${message}] message`, err, err.meta);
		}
	}

	private async _logDevelop(log_level: LOG_LEVELS, message: string, context?: LogContext) {
		if (!this.local_log_warning_printed) {
			console.warn(
				'Couldn\'t log to Elastic in non production enviroment.\n' +
				'Set NODE_ENV to "production", or FORCE_ELASTIC_LOGS to "true"'
			);
			this.local_log_warning_printed = true;
		}
		console.log('-----------------------');
		console.log(`LOG_LEVEL: ${log_level}`);
		console.log(`Message: ${message}`);
		console.log(`Context:`, context);
		console.log('-----------------------');
	}

	async log(log_level: LOG_LEVELS, message: string, context?: LogContext) {
		console.log('About to log!', log_level, message);
		if (process.env.NODE_ENV !== 'production' &&
			process.env.FORCE_ELASTIC_LOGS !== "true") {
			this._logDevelop(log_level, message, context);
		} else {
			this._logProduction(log_level, message, context);
		}

	}

	async info(message: string, context?: LogContext) {
		return this.log(LOG_LEVELS.INFO, message, context);
	}

	async warning(message: string, context?: LogContext) {
		return this.log(LOG_LEVELS.WARNING, message, context);
	}

	async error(message: string, context?: LogContext) {
		return this.log(LOG_LEVELS.ERROR, message, context);
	}

	async notice(message: string, context?: LogContext) {
		return this.log(LOG_LEVELS.NOTICE, message, context);
	}

	async debug(message: string, context?: LogContext) {
		if (process.env.LOG_LEVEL === 'debug') {
			return this.log(LOG_LEVELS.DEBUG, message, context);
		}
	}
}
