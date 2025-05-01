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
  tags: [
    {
      name: 'Users',
      description: 'Endpoints for user management',
    },
    {
      name: 'Content',
      description: 'Endpoints for content management',
    },
    {
      name: 'Authentication',
      description: 'Endpoints for user authentication',
    },
    {
      name: 'Channels',
      description: 'Endpoints for channel management',
    },
    {
      name: 'Subscriptions',
      description: 'Endpoints for subscription management',
    },
    {
      name: 'Community',
      description: 'Endpoints for community posts',
    },
    {
      name: 'Role Changes',
      description: 'Endpoints for user role changes',
    },
  ],
};

// Use absolute path for route files, matching the capitalized 'Routes' directory
const routesPath = path.join(__dirname, 'Routes', '*.js');
console.log('Swagger routes path:', routesPath);

// Get all route files with absolute paths
const routeFiles = glob.sync(routesPath, { absolute: true });

// Fallback to explicit file list if glob doesn't work
const apiFiles = routeFiles.length > 0 ? routeFiles : [
  path.join(__dirname, 'Routes', 'userRoute.js'),
  path.join(__dirname, 'Routes', 'contentRoute.js'),
  path.join(__dirname, 'Routes', 'roleChangeRoute.js'),
  path.join(__dirname, 'Routes', 'subscribeRoute.js'),
  path.join(__dirname, 'Routes', 'channelRoute.js'),
  path.join(__dirname, 'Routes', 'communityPostRoute.js'),
].filter((file) => {
  const exists = require('fs').existsSync(file);
  if (!exists) console.warn(`Warning: Route file not found: ${file}`);
  return exists;
});

if (!apiFiles.length) {
  console.error('Error: No valid route files found for Swagger documentation!');
  console.error('Check the Routes directory and ensure route files exist.');
}

console.log('Swagger will scan these files:', apiFiles);

const options = {
  swaggerDefinition,
  apis: apiFiles,
};

// Generate the Swagger specification with error handling
let swaggerSpec;
try {
  swaggerSpec = swaggerJSDoc(options);

  // Validate that paths were found
  if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
    console.error('Warning: No API paths found in the generated Swagger spec!');
    console.error('Possible causes:');
    console.error('- Route files not found in', routesPath);
    console.error('- Missing or incorrect JSDoc comments in route files');
    console.error('- Path prefix mismatch (e.g., /api prefix) in route definitions');
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('Swagger spec generated successfully with paths:');
    console.log(Object.keys(swaggerSpec.paths));
  }
} catch (error) {
  console.error('Error generating Swagger spec:', error.message);
  swaggerSpec = { openapi: '3.0.0', info: { title: 'Error', version: '1.0.0' }, paths: {} };
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