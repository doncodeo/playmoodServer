const swaggerJSDoc = require('swagger-jsdoc');
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
      url: process.env.NODE_ENV === 'production'
        ? 'https://playmoodserver-stg-0fb54b955e6b.herokuapp.com'
        : 'http://localhost:5000',
      description: process.env.NODE_ENV === 'production' ? 'Live server' : 'Development server',
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

// Explicitly list route files with absolute paths
const routeFiles = [
  'userRoute.js',
  'contentRoute.js',
  'roleChangeRoute.js',
  'subscribeRoute.js',
  'channelRoute.js',
  'communityPostRoute.js',
].map(file => path.join(__dirname, 'routes', file));

console.log('Swagger route files:', routeFiles);

// Verify that the files exist
const fs = require('fs');
routeFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`Route file not found: ${file}`);
  } else {
    console.log(`Route file found: ${file}`);
  }
});

const options = {
  swaggerDefinition,
  apis: routeFiles,
};

const swaggerSpec = swaggerJSDoc(options);

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