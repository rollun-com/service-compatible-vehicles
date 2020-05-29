const host = `localhost:${process.env.PORT || 80}`;

const swaggerDefinition = {
  info: {
    // API informations (required)
    title: 'Health checker', // Title (required)
    version: '1.0.0', // Version (required)
    description: 'This service makes sure other services are working correctly. Also it can store metrics data', // Description (optional)
  },
  host: 'health-checker', // Host (optional)
  basePath: '/', // Base path (optional)
  produces: ["application/json",],
  schemes: ['http']
};

export default {
  swaggerDefinition,
  apis: ['./src/**/*.ts', 'server.ts', 'swagger.types.yaml'],
  basePath: '/', // Base path (optional)
};
