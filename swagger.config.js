const host = `localhost:${process.env.PORT || 80}`;

const swaggerDefinition = {
  info: {
    // API informations (required)
    title: 'Compatible vehicles', // Title (required)
    version: '1.0.0', // Version (required)
    description: 'Service find compatible vehicles', // Description (optional)
  },
  host: host || 'comp-vehicles', // Host (optional)
  basePath: '/', // Base path (optional)
  produces: ["application/json",],
  schemes: ['http']
};

export default {
  swaggerDefinition,
  apis: ['./src/**/*.ts', 'server.ts', 'swagger.types.yaml'],
  basePath: '/', // Base path (optional)
};
