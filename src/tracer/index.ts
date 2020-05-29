import { track, Tracer } from 'express-jaeger';
import * as openTracing         from 'opentracing';
import { globalLogger } from "../../server";

const config = {
	serviceName: process.env.SERVICE_NAME,
	sampler: {
		type: 'const',
		param: 1,
	},
	reporter: {
		collectorEndpoint: process.env.JAEGER_COLLECTOR_ENDPOINT,
		agentHost: process.env.JAEGER_AGENT_HOST,
		agentPort: process.env.JAEGER_AGENT_PORT,
		logSpans: true
	}
};

const options = {
	logger: {
		info: function logInfo(msg: string) {
			// logger.debug(msg);
		},
		error: function logError(msg: string) {
			globalLogger.error(msg);
		},
	}
};

export const traceMiddleware = (name = '') => {
	return track(name, null, config, options);
};

export const tracer = Tracer() as openTracing.Tracer;

