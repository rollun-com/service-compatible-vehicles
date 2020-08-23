import { Router }     from "express";
import swaggerOptions from "../../swagger.config";
import swaggerJSDoc   from "swagger-jsdoc";
import swaggerUI      from "swagger-ui-express";

const swaggerSpec = swaggerJSDoc(swaggerOptions);
const docsRouter = Router();

/**
 * @swagger
 * /api/docs/openapi.json:
 *   get:
 *     tags:
 *       - "/api/docs"
 *     description: Returns documentation as OpenAPI spec
 *     responses:
 *       200:
 *         description: OK
 *         schema:
 *           type: "object"
 *           description: Valid OpenAPI doc in JSON format.
 *           example: {"info":{"title":"Health checker","version":"1.0.0","description":"This service has only one purpose, make sure other services are working correctly"},"host":"localhost:9001","basePath":"/","produces":["application/json"],"schemes":["http"],"swagger":"2.0","paths":{"/api/cron/CheckSupplierFilesUpdateTime":{"get":{"tags":["/api/cron"],"description":"Return time, from last update in passed file(table) in seconds. Also time will be updated in table supplier_files_update_time","parameters":[{"in":"query","name":"fileEndPoint","description":"Link to datastore, that contains file data. Datastore MUST have filed update_timestamp.","required":true,"schema":{"type":"string","example":"http://catalog/api/datastore/PartsUnlimitedROL045PriceFileCacheDataStore"}},{"in":"query","name":"displayName","description":"An alias for File.","schema":{"type":"string","example":"PU Price"}}],"responses":{"200":{"description":"OK","schema":{"type":"object","properties":{"fileTimeDiff":{"type":"integer","example":47834}}}},"400":{"description":"Invalid params","schema":{"$ref":"#/definitions/Error"}},"500":{"description":"Internal server error","schema":{"$ref":"#/definitions/Error"}}}}},"/ping":{"get":{"tags":["/"],"description":"Returns current server time. Can be used to test connection to service","responses":{"200":{"description":"OK","schema":{"type":"object","properties":{"ping":{"type":"string","example":"current server time is 2020-04-12T21:25:16.679Z"}}}}}}}},"definitions":{"Error":{"type":"object","properties":{"error":{"type":"string","description":"Message, that describes what went wrong","example":"Error message"}}}},"responses":{},"parameters":{},"securityDefinitions":{},"tags":[]}
 */

docsRouter.get('/api/docs/openapi.json', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(swaggerSpec);
});

/**
 * @swagger
 * /api/docs:
 *   get:
 *     tags:
 *       - "/api/docs"
 *     description: Swagger UI, renders doc for this service
 *     responses:
 *       200:
 *         description: OK
 */

docsRouter.use('/api/docs', swaggerUI.serve);
docsRouter.get('/api/docs', swaggerUI.setup(swaggerSpec));

export default docsRouter;
