const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'profiles',
        required: true
    },
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
    },
    shortPreview: {
        type: String,
    },
    credit: {
        type: String,
        required: true,
    },
    video: {
        type: String,
        required: true,
    },
    cloudinary_video_id: {
        type: String,
    },
    cloudinary_thumbnail_id: {
        type: String,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Contents', contentSchema);





// const mongoose = require('mongoose');
// const { ObjectId } = mongoose.Schema.Types;

// const contentSchema = new mongoose.Schema({

//     user: {
//         type: ObjectId,
//         ref: 'profiles', // Reference to the User model
//         required: true
//     },
    
//     title: {
//         type: String,
//         required: true,
//     },
//     category: {
//         type: String,
//         required: true,
//     },
//     description: {
//         type: String,
//         required: true, 
//     },
//     thumbnail: {
//         type: String
//       },
//     shortPreview: {
//         type: String,
//     },
//     credit: {
//         type: String,
//         required: true, 
//     },
//     video: {
//         type: String,
//         require: true
//     }, 

//     cloudinary_video_id: {
//         type: String,
//     },
//     cloudinary_thumbnail_id: {
//         type: String,
//     }
    
// }, 
// {
//  timestamps: true,
// })

// module.exports = mongoose.model('Contents', contentSchema)

