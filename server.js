const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://playmoodtv.com',
];

app.use(cors({
  origin: allowedOrigins,
}));

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

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(port, () => console.log(`Server started on port ${port}`));
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });

