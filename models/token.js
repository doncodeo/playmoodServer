const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const tokenSchema = new Schema ({
    userId: {
        type: String,
        ref: "profile",
        require: true
    },
    token: {
        type: String,
        require: true
    }
});

module.exports = mongoose.model('token' , tokenSchema)

