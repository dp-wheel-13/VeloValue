const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,       // for email/password login
    googleId: String,       // for Google login
    facebookId: String,     // for Facebook login
    appleId: String,        // for Apple login
    avatar: String,         // profile picture from social login
});

module.exports = mongoose.model('User', userSchema);
