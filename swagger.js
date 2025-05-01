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
    {
      url: 'http://localhost:5000',
      description: 'Development server',
    }
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
  // Add basePath to ensure all routes are properly prefixed
  basePath: '/api',
  // Add tags for better organization
  tags: [
    {
      name: 'Users',
      description: 'Endpoints for user management'
    },
    {
      name: 'Content',
      description: 'Endpoints for content management'
    },
    {
      name: 'Authentication',
      description: 'Endpoints for user authentication'
    }
  ]
};

// Use absolute path for reliability across environments
const routesPath = path.join(__dirname, 'routes', '*.js');
console.log('Swagger routes path:', routesPath);

// Get all route files with absolute paths
const routeFiles = glob.sync(routesPath, { absolute: true });

// Fallback to explicit file list if glob doesn't work
const apiFiles = routeFiles.length > 0 ? routeFiles : [
  path.join(__dirname, 'routes', 'userRoute.js'),
  path.join(__dirname, 'routes', 'contentRoute.js'),
  path.join(__dirname, 'routes', 'roleChangeRoute.js'),
  path.join(__dirname, 'routes', 'subscribeRoute.js'),
  path.join(__dirname, 'routes', 'channelRoute.js'),
  path.join(__dirname, 'routes', 'communityPostRoute.js')
];

console.log('Swagger will scan these files:', apiFiles);

const options = {
  swaggerDefinition,
  apis: apiFiles,
  // Enable better parsing of JSDoc comments
  explorer: true,
  swaggerOptions: {
    validatorUrl: null, // Disable validator if not needed
    docExpansion: 'list', // Control how operations are shown
    defaultModelsExpandDepth: -1 // Hide schemas by default
  }
};

// Generate the Swagger specification
const swaggerSpec = swaggerJSDoc(options);

// Validate that paths were found
if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
  console.error('Warning: No API paths found in the generated Swagger spec!');
  console.error('Possible causes:');
  console.error('- Route files not found in', routesPath);
  console.error('- Incorrect JSDoc comments in route files');
  console.error('- Path prefix mismatch between routes and Swagger docs');
} else {
  console.log('Swagger spec generated successfully with paths:');
  console.log(Object.keys(swaggerSpec.paths));
}

module.exports = swaggerSpec;





// const swaggerJSDoc = require('swagger-jsdoc');
// const glob = require('glob');
// const path = require('path');

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'PlaymoodTV API',
//     version: '1.0.0',
//     description: 'API documentation for the PlaymoodTV platform, including user management, content interaction, and more.',
//   },
//   servers: [
//     {
//       url: 'https://playmoodserver-stg-0fb54b955e6b.herokuapp.com',
//       description: 'Live server',
//     },
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

// // Use absolute path for reliability
// const routesPath = path.join(__dirname, 'routes', '*.js');
// console.log('Swagger routes path:', routesPath);

// // Log scanned files for debugging
// const routeFiles = glob.sync(routesPath, { absolute: true });
// console.log('Swagger scanned files:', routeFiles);

// if (!routeFiles.length) {
//   console.error('No route files found! Check the routes directory and glob pattern.');
// }

// const options = {
//   swaggerDefinition,
//   apis: routeFiles.length ? routeFiles : [routesPath],
// };

// const swaggerSpec = swaggerJSDoc(options);

// // Log the generated spec for debugging
// console.log('Generated Swagger Spec:', JSON.stringify(swaggerSpec, null, 2));

// module.exports = swaggerSpec;





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