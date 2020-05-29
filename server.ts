import express                                                       from "express";
import bodyParser                                                    from "body-parser";
import LogClient                                                     from './src/logger/elastic-logger';
import { errorMiddleware, injectLifecycleToken, notFoundMiddleware } from "./src/middlewares";
import handlePing                                                    from "./src/services/ping/controllers";
import makeMySQLConnectionsPool                                      from "./src/utils/make-mysql-connections-pool";

let PORT = 80;

if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
	PORT = +process.env.PORT || 8081;
}

// swagger imported after env init ,because PORT variable, that must be in doc, comes from env
import vehiclesCompatiblesRouter from "./src/api/vehicles-compatibles";
// import { tracer, traceMiddleware } from "./src/tracer";
import { RequestWithAddons }     from "./src/utils/types";

// global logger instance.
export const globalLogger = new LogClient({
	index_name: process.env.ELS_INDEX_NAME,
	host: process.env.LOGSTASH_HOST,
	port: +process.env.LOGSTASH_PORT
});

export const mysql = makeMySQLConnectionsPool();

const app = express();

// app.use(traceMiddleware());


app.use(bodyParser.json());
app.use(bodyParser.text());
// to support URL-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));

app.use(injectLifecycleToken());

app.use((req: RequestWithAddons, res, next) => {
	req.logger.debug('Got request', {
		url: req.url,
		method: req.method,
		query: req.query,
		body: req.body
	});
	next();
});

/**
 * @swagger
 * /ping:
 *   get:
 *     tags:
 *       - "/"
 *     description: Returns current server time. Can be used to test connection to service
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: "object"
 *           properties:
 *             ping:
 *               type: "string"
 *               example: "current server time is 2020-04-12T21:25:16.679Z"
 */

app.get('/ping', handlePing);
app.use(vehiclesCompatiblesRouter);

// 500 handler
app.use(errorMiddleware);
// 404 handler after all routes and middleware
app.use(notFoundMiddleware);

const server = app.listen(PORT, () => {
	const address = server.address();
	globalLogger.notice('healthchecker service started!');
	console.log('healthchecker app started. ', address);
});
