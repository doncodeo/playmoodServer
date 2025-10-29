const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const helmet = require('helmet'); // Add helmet
const { generalLimiter } = require('./middleware/rateLimiter');
const compression = require('compression'); // Add compression
const mongoSanitize = require('express-mongo-sanitize'); // Add input sanitizer
const { initWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);
let workerInstance;

if (process.env.NODE_ENV !== 'test') {
  app.set('trust proxy', 1); // Trust the first proxy
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}
const passport = require('passport');
const port = process.env.PORT || 5000;

// Passport config
require('./config/passport')(passport);

app.use(passport.initialize());

// Security: Set secure HTTP headers
app.use(helmet());

// Security: Sanitize data to prevent NoSQL injection
app.use(mongoSanitize());

// Security: Rate limiting
app.use(generalLimiter);

// Security: Hide X-Powered-By header
app.disable('x-powered-by');

// Enable CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://playmoodtv.com',
  "https://playmoodtv.netlify.app",
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
app.use(express.json({ limit: '3gb' }));
app.use(express.urlencoded({ extended: true, limit: '3gb' }));

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
app.use('/api/highlights', require('./Routes/highlightRoute'));
app.use('/api/ai', require('./Routes/aiRoute'));
app.use('/api/analytics', require('./Routes/analyticsRoute'));
app.use('/api/feed', require('./Routes/feedPostRoute'));

// Serve login.html for /login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html')); 
});

// Serve index.html for any non-API GET requests
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

if (require.main === module) {
  connectDB()
    .then(() => {
      console.log('MongoDB connected successfully.');
      initWebSocket(server); // Initialize WebSocket
      server.listen(port, () => console.log(`Server started on port ${port}`));
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\nGracefully shutting down...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      // Close MongoDB connection
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close(false, () => {
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

// Only attach signal handlers if not in test environment
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { app, server };
