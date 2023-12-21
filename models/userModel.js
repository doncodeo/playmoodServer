const mongoose = require ('mongoose')

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
//     favorites: [{
//     type: String,
//     required: false
// }],
profileImage: {
    type: String,
    unique: true  
},
// friends: {
//     type: String,
//      required: false
// },
// watchlist: {
//     type: String,
//     required: false
// },
// history: {
//     type: String,
//     required: false
// },
// subscription: {
//     type: String,
//     required: false

// }

},
{
    timestamps: true
})

module.exports = mongoose.model('Profile' , userSchema)