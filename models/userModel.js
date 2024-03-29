const mongoose = require ('mongoose');
const {ObjectId} = mongoose.Schema.Types

// Define an enumeration for user roles
const userRoles = ['user', 'creator', 'admin'];

const userSchema = mongoose.Schema({

name: { 
    type: String,
    required: [true, "kindly enter full name"]
},
email: {
    type: String,
    required: [true, "kindly enter your email"],
    unique: true
},
password: {
    type: String,
    required: [true, "kindly enter your password"]
},
role: { 
    type:String,
    enum: userRoles, // Restrict the 'role' field to values in the 'userRoles' array
    default: "user" //Default role is user
},   

profileImage: {
    type: String,
    // unique: true  
},

cloudinary_id: {
    type: String,
},

thumnail_id: {
    type: String,
},

likes: [{ type: ObjectId, ref: 'Contents' }],
watchlist: [{ type: ObjectId, ref: 'Contents' }],
history: [{ type: ObjectId, ref: 'Contents' }],
verified: {
    type: Boolean,
    default: false
}
},
{
    timestamps: true
})

module.exports = mongoose.model('profiles' , userSchema)