const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const helmet = require('helmet'); // Add helmet
const rateLimit = require('express-rate-limit'); // Add rate limiter
const compression = require('compression'); // Add compression
const mongoSanitize = require('express-mongo-sanitize'); // Add input sanitizer

const app = express();
const port = process.env.PORT || 5000;

// Security: Set secure HTTP headers
app.use(helmet());

// Security: Sanitize data to prevent NoSQL injection
app.use(mongoSanitize());

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Security: Hide X-Powered-By header
app.disable('x-powered-by');

// Enable CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://playmoodtv.com',
];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // if you need cookies/auth
}));

// Optimization: Compress all responses
app.use(compression());

// Serve static files
app.use(express.static(path.join(__dirname, 'public'))); 

// Middleware for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Swagger UI at /api-docs
// Serve Swagger UI at /api-docs with custom options
app.use( 
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      validatorUrl: null, // Disable external validator
      docExpansion: 'list', // Expand operations by default
      defaultModelsExpandDepth: -1, // Hide schema models by default
    },
  })
);

// Routes
app.use('/api/content', require('./Routes/contentRoute'));
app.use('/api/users', require('./Routes/userRoute'));
app.use('/api/rolechange', require('./Routes/roleChangeRoute')); 
app.use('/api/subscribe', require('./Routes/subscribeRoute'));
app.use('/api/channel', require('./Routes/channelRoute'));
app.use('/api/community', require('./Routes/communityPostRoute'));
app.use('/api/playlists', require('./Routes/playlistRoutes'));
app.use('/api/users', require('./Routes/forgetPasswordRoute'));

// Serve login.html for /login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html')); 
});

// Serve index.html for any other route (excluding OPTIONS method)
app.get('*', (req, res) => {
  if (req.method !== 'OPTIONS') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

let server;

connectDB()
  .then(() => {
    server = app.listen(port, () => console.log(`Server started on port ${port}`));
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });

// Graceful shutdown
const shutdown = async () => {
  console.log('\nGracefully shutting down...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      // Close MongoDB connection if using Mongoose
      if (typeof require('mongoose').connection.close === 'function') {
        require('mongoose').connection.close(false, () => {
          console.log('MongoDB connection closed.');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0); 
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

