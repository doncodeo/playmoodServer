const mongoose = require('mongoose') 

const top10Schema = new mongoose.Schema({
    
    title: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    descripton: {
        type: String,
        required: true, 
    },
    thumbnail: {
        type: String,
        required: true, 
      },
    shortPreview: {
        type: String,
        required: true,
    },
    credit: {
        type: String,
        required: true, 
    },
    video: {
        type: String,
        require: true
    }
}, 
{
 timestamps: true,
})

module.exports = mongoose.model('Top10', top10Schema)