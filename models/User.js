
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // Account information
    name: String,
    email: { type: String, unique: true },
    password: String,

    // Social authentication
    googleId: String,
    facebookId: String,
    appleId: String,

    // Profile
    avatar: String,
    sex: {
        type: String,
        default: ''
    },
    dateofbirth: {
        type: String,
        default: ''
    },

    // Preferences
    country: {
        type: String,
        default: 'it'
    },
    language: {
        type: String,
        default: 'en'
    },
    currency: {
        type: String,
        default: 'EUR'
    },
    notifications: {
        type: String,
        default: 'on'
    }
});

module.exports = mongoose.model('User', userSchema);
