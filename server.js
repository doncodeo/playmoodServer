const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const connectDB = require('./config/db');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// MongoDB Configuration 

const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri)



// connect to the MongoDB 

connectDB()
    .then(()=>{
        // enable CORS 
        app.use(cors());

        // Middleware for JSON and URL-encoded data
        app.use(express.json());
        app.use(express.urlencoded({extended:false}));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended:true}))

        // Routes 
        app.use('/api/top10', require('./Routes/top10Route'))
        app.use('/api/user', require('./Routes/userRoute'))

    

        // Example route for "top10" collection 
        // app.get('/api/top10', async (req, res) => {
        //     try {
        //       const db = client.db('playmood');
        //       const categoryName = 'top10';
        //       const categoryData = await db.collection(categoryName).find({}).toArray();
        //       return res.json(categoryData);
        //     } catch (error) {
        //       console.error(error);
        //       return res.status(500).json({ error: 'Internal Server Error' });
        //     }
        //   });
       
        
        // Start the server 
        app.listen(port, () => console.log(`server started on port ${port}`))

    })
    .catch((error) => {
        console.error(error);
        process.exit(1)
    })