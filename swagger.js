const swaggerJSDoc = require('swagger-jsdoc');
const glob = require('glob');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'PlaymoodTV API',
    version: '1.0.0',
    description: 'API documentation for the PlaymoodTV platform, including user management, content interaction, and more.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development server',
    },
    {
      url: 'https://playmoodserver-stg-0fb54b955e6b.herokuapp.com',
      description: 'Live server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

// Log scanned files for debugging
const routeFiles = glob.sync('./routes/*.js');
console.log('Swagger scanning files:', routeFiles);

const options = {
  swaggerDefinition,
  apis: routeFiles.length ? routeFiles : ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;