const mongoose = require('mongoose');
const {ObjectId} = mongoose.Schema.Types

const contentSchema = new mongoose.Schema({
    
    title: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    description: {
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
    }, 
    likes: [{type:ObjectId, ref:'user'}],
}, 
{
 timestamps: true,
})

module.exports = mongoose.model('Contents', contentSchema)