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
    schemas: {
      Highlight: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'The highlight ID.' },
          startTime: { type: 'number', description: 'Start time of the highlight in seconds.' },
          endTime: { type: 'number', description: 'End time of the highlight in seconds.' },
          storageKey: { type: 'string', description: 'R2 storage key for the highlight video.' },
          storageProvider: { type: 'string', enum: ['cloudinary', 'r2'], default: 'cloudinary' },
          user: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              profileImage: { type: 'string' },
            },
            description: 'The user who created the highlight.',
          },
          content: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              title: { type: 'string' },
              thumbnail: { type: 'string' },
              views: { type: 'number' },
              description: { type: 'string' },
              category: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              likesCount: { type: 'number' },
              commentsCount: { type: 'number' },
              comments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    _id: { type: 'string' },
                    text: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    user: {
                      type: 'object',
                      properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        profileImage: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            description: 'The original content from which the highlight was created.',
          },
        },
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
      description: `Endpoints for content management. The content creation process is a two-step flow:
      1. **Generate Signature/URL**: The client first requests a secure signature (Cloudinary) or Presigned URL (R2) from the server via the \`/api/content/signature\` endpoint.
      2. **Direct Upload & Create Record**: The client uses this signature/URL to upload the video file directly to the storage provider. Once the upload is complete, the client sends the provider's response (including the key or public_id and URL) along with other metadata to the \`/api/content\` endpoint to create the content record in the database.`,
    },
    {
      name: 'Highlights',
      description: 'Endpoints for creating and retrieving video highlights.',
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
    {
      name: 'Playlists',
      description: 'Endpoints for playlist management',
    },
    {
      name: 'Analytics',
      description: 'Endpoints for platform and creator analytics',
    },
  ],
};

// Use absolute path for route files, matching the capitalized 'Routes' directory
const routesPath = path.join(__dirname, 'Routes', '*.js');
// console.log('Swagger routes path:', routesPath);exit

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
  path.join(__dirname, 'Routes', 'playlistRoutes.js'),
  path.join(__dirname, 'Routes', 'analyticsRoute.js'),
  path.join(__dirname, 'Routes', 'highlightRoute.js'),

].filter((file) => {
  const exists = require('fs').existsSync(file);
  if (!exists) console.warn(`Warning: Route file not found: ${file}`);
  return exists;
});

if (!apiFiles.length) {
  console.error('Error: No valid route files found for Swagger documentation!');
  console.error('Check the Routes directory and ensure route files exist.');
}

// console.log('Swagger will scan these files:', apiFiles); 

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
    // console.error('Warning: No API paths found in the generated Swagger spec!');
    // console.error('Possible causes:');
    // console.error('- Route files not found in', routesPath); 
    // console.error('- Missing or incorrect JSDoc comments in route files');
    // console.error('- Path prefix mismatch (e.g., /api prefix) in route definitions');
  } else if (process.env.NODE_ENV !== 'production') {
    // console.log('Swagger spec generated successfully with paths:');
    // console.log(Object.keys(swaggerSpec.paths)); 
  }
} catch (error) {
  // console.error('Error generating Swagger spec:', error.message);
  swaggerSpec = { openapi: '3.0.0', info: { title: 'Error', version: '1.0.0' }, paths: {} };
}

module.exports = swaggerSpec;