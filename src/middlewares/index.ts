import { NextFunction, Response } from "express";
import { randomString }           from 'rollun-ts-utils';
import axios                      from 'axios';
import LogClient                  from "../logger/elastic-logger";
import { RequestWithAddons }      from "../utils/types";
import { globalLogger }           from "../../server";

/**
 * Caught global error
 * 4-th argument need to be in callback declaration, just to match overload of app.use().
 */

export const errorMiddleware = (err: any, req: RequestWithAddons, res: Response, next: NextFunction) => {
	console.log('Got global error!');
	globalLogger.error('service-health-checker global error', {
		url: req.url,
		method: req.method,
		query: req.query,
		body: req.body,
		err: {
			error_message: err.message,
			error_stack: err.stack
		}
	});
	res
		.status(500)
		.send({error: `Uncaught global error: ${err.message}`});
};

/**
 * Handle 404
 */

export const notFoundMiddleware = (req, res) => res.status(404).send({
	error: `${req._parsedUrl.pathname} with method ${req.method} Not found!`
});

export const injectLifecycleToken = () => {
	return (req, _, next) => {
		const LCToken = randomString(30, 'QWERTYUIOPASDFGHJKLZXCVBNM0123456789');
		const ParentLCToken = req.header('lifecycle_token') || null;
		req.axios = axios.create({
			headers: {
				'lifecycle_token': LCToken,
				'parent_lifecycle_token': ParentLCToken
			}
		});
		req.logger = globalLogger;
		next();
	}
};
