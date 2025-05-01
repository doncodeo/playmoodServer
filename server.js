const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const { MongoClient } = require('mongodb');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
const port = process.env.PORT || 5000;

// Set CSP to allow Swagger UI
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://playmoodserver-stg-0fb54b955e6b.herokuapp.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://playmoodserver-stg-0fb54b955e6b.herokuapp.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Configuration
const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri);

// Connect to MongoDB
connectDB()
  .then(() => {
    // Enable CORS
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://playmoodtv.com',
    ];

    app.use(
      cors({
        origin: allowedOrigins,
      })
    );

    // Middleware for JSON and URL-encoded data
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Serve Swagger UI at /api-docs
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // Routes
    app.use('/api/content', require('./routes/contentRoute'));
    app.use('/api/user', require('./routes/userRoute'));
    app.use('/api/rolechange', require('./routes/roleChangeRoute'));
    app.use('/api/subscribe', require('./routes/subscribeRoute'));
    app.use('/api/channel', require('./routes/channelRoute'));
    app.use('/api/community', require('./routes/communityPostRoute'));

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

    // Debug endpoint to list route files
    const fs = require('fs');
    app.get('/debug/routes', (req, res) => {
      const files = fs.readdirSync('./routes');
      res.json(files);
    });

    // Start the server
    app.listen(port, () => console.log(`Server started on port ${port}`));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const dotenv = require('dotenv').config();
// const connectDB = require('./config/db');
// const { MongoClient } = require('mongodb');
// const path = require('path');
// const swaggerUi = require('swagger-ui-express');
// const swaggerSpec = require('./swagger');

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(express.static(path.join(__dirname, 'public')));

// // MongoDB Configuration 
// const uri = process.env.MONGO_CONNECTION_STRING;
// const client = new MongoClient(uri);

// // Connect to MongoDB 
// connectDB()
//   .then(() => {
//     // Enable CORS 
//     const allowedOrigins = [
//       'http://localhost:5173',
//        'http://localhost:5174',
//       'https://playmoodtv.com',
//       // Add any other origins as needed
//     ];

//     app.use(cors({
//       origin: allowedOrigins,
//     }));

//     // Serve Swagger UI at /api-docs
//     app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//     // Middleware for JSON and URL-encoded data
//     app.use(express.json());
//     app.use(express.urlencoded({ extended: false }));
//     app.use(bodyParser.json());
//     app.use(bodyParser.urlencoded({ extended: true }));

//     // Routes 
//     app.use('/api/content', require('./Routes/contentRoute'));
//     app.use('/api/user', require('./Routes/userRoute'));
//     app.use('/api/rolechange', require('./Routes/roleChangeRoute'));
//     app.use('/api/subscribe', require('./Routes/subscribeRoute'));
//     app.use('/api/channel', require('./Routes/channelRoute'));
//     // below route not tested yet
//     app.use('/api/community', require('./Routes/communityPostRoute'));


//     app.use(express.static(path.join(__dirname, 'public')));
 
//     // Serve login.html for /login route
//     app.get('/login', (req, res) => {
//       res.sendFile(path.join(__dirname, 'public', 'login.html'));
//     });

//     // Serve index.html for any other route (excluding OPTIONS method)
//     app.get('*', (req, res) => {
//       if (req.method !== 'OPTIONS') {
//         res.sendFile(path.join(__dirname, 'public', 'index.html'));
//       }
//     });

//     // Start the server 
//     app.listen(port, () => console.log(`Server started on port ${port}`));
//   })
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });





// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const dotenv = require('dotenv').config();
// const connectDB = require('./config/db');
// const { MongoClient } = require('mongodb');
// const path = require('path');

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(express.static('public'));

// // MongoDB Configuration 
// const uri = process.env.MONGO_CONNECTION_STRING;
// const client = new MongoClient(uri);

// // Connect to MongoDB 
// connectDB()
//   .then(() => {
//     // Enable CORS 
//     const allowedOrigins = [
//       'http://localhost:5173',
//       'https://playmoodtv.com',
//       // Add any other origins as needed
//     ];

//     app.use(cors({
//       origin: allowedOrigins,
//     }));

//     // Middleware for JSON and URL-encoded data
//     app.use(express.json());
//     app.use(express.urlencoded({ extended: false }));
//     app.use(bodyParser.json());
//     app.use(bodyParser.urlencoded({ extended: true }));

//     // Routes 
//     app.use('/api/content', require('./Routes/contentRoute'));
//     app.use('/api/user', require('./Routes/userRoute'));

//       // Handling Preflight OPTIONS requests
//       app.options('*', cors());

//     // Serve login.html for /login route
//     app.get('/login', (req, res) => {
//       res.sendFile(path.join(__dirname, 'public', 'login.html'));
//     });

//     // Serve index.html for any other route (excluding OPTIONS method)
//     app.get('*', (req, res) => {
//       if (req.method !== 'OPTIONS') {
//         res.sendFile(path.join(__dirname, 'public', 'index.html'));
//       }
//     });

//     // // Handling Preflight OPTIONS requests
//     // app.options('*', cors());

//     // Start the server 
//     app.listen(port, () => console.log(`Server started on port ${port}`));

//   })
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });






  


// // const express = require('express');
// // const cors = require('cors');
// // const bodyParser = require('body-parser');
// // const dotenv = require('dotenv').config();
// // const connectDB = require('./config/db');
// // const { MongoClient } = require('mongodb');
// // const path = require('path');

// // const app = express();
// // const port = process.env.PORT || 5000;

// // app.use(express.static('public'));

// // // MongoDB Configuration 
// // const uri = process.env.MONGO_CONNECTION_STRING;
// // const client = new MongoClient(uri);

// // // Connect to MongoDB 
// // connectDB()
// //   .then(() => {
// //     // Enable CORS 
// //     const allowedOrigins = [
// //       'http://localhost:5173',
// //       'https://playmoodtv.com',
// //       // Add any other origins as needed
// //     ];

// //     app.use(cors({
// //       origin: allowedOrigins,
// //     }));

// //     // Middleware for JSON and URL-encoded data
// //     app.use(express.json());
// //     app.use(express.urlencoded({ extended: false }));
// //     app.use(bodyParser.json());
// //     app.use(bodyParser.urlencoded({ extended: true }));

// //     // Handling Preflight OPTIONS requests
// //     app.options('*', cors());

// //     // Routes 
// //     app.use('/api/content', require('./Routes/contentRoute'));
// //     app.use('/api/user', require('./Routes/userRoute'));

// //     // Serve login.html for /login route
// //     app.get('/login', (req, res) => {
// //       res.sendFile(path.join(__dirname, 'public', 'login.html'));
// //     });

// //     // Serve index.html for any other route (excluding OPTIONS method)
// //     app.get('*', (req, res) => {
// //       if (req.method !== 'OPTIONS') {
// //         res.sendFile(path.join(__dirname, 'public', 'index.html'));
// //       }
// //     });

// //     // Start the server 
// //     app.listen(port, () => console.log(`Server started on port ${port}`));

// //   })
// //   .catch((error) => {
// //     console.error(error);
// //     process.exit(1);
// //   });

