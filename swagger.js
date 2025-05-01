const swaggerJSDoc = require('swagger-jsdoc');
const glob = require('glob');
const path = require('path');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'PlaymoodTV API',
    version: '1.0.0',
    description: 'API documentation for the PlaymoodTV platform, including user management, content interaction, and more.',
  },
  servers: [
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

// Use absolute path for reliability
const routesPath = path.join(__dirname, 'routes', '*.js');
console.log('Swagger routes path:', routesPath);

// Log scanned files for debugging
const routeFiles = glob.sync(routesPath, { absolute: true });
console.log('Swagger scanned files:', routeFiles);

if (!routeFiles.length) {
  console.error('No route files found! Check the routes directory and glob pattern.');
}

const options = {
  swaggerDefinition,
  apis: routeFiles.length ? routeFiles : [routesPath],
};

const swaggerSpec = swaggerJSDoc(options);

// Log the generated spec for debugging
console.log('Generated Swagger Spec:', JSON.stringify(swaggerSpec, null, 2));

module.exports = swaggerSpec;





// const swaggerJSDoc = require('swagger-jsdoc');
// const glob = require('glob');

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'PlaymoodTV API',
//     version: '1.0.0',
//     description: 'API documentation for the PlaymoodTV platform, including user management, content interaction, and more.',
//   },
//   servers: [
//     // {
//     //   url: 'http://localhost:5000',
//     //   description: 'Development server',
//     // },
//     {
//       url: 'https://playmoodserver-stg-0fb54b955e6b.herokuapp.com',
//       description: 'Live server',
//     }
//   ],
//   components: {
//     securitySchemes: {
//       BearerAuth: {
//         type: 'http',
//         scheme: 'bearer',
//         bearerFormat: 'JWT',
//       },
//     },
//   },
// };

// // Log scanned files for debugging
// const routeFiles = glob.sync('./routes/*.js');
// console.log('Swagger scanning files:', routeFiles);

// const options = {
//   swaggerDefinition,
//   apis: routeFiles.length ? routeFiles : ['./routes/*.js'],
// };

// const swaggerSpec = swaggerJSDoc(options);

// module.exports = swaggerSpec;