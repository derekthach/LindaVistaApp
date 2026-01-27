const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

function authenticateUser(username, password, callback) {
    try {
        const usersPath = path.join(__dirname, '..', 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(user => user.username === username);

        if (user) {
            bcrypt.compare(password, user.password, function(err, result) {
                if (err) return callback(err);
                callback(null, result);
            });
        } else {
            callback(null, false);
        }
    } catch (error) {
        console.error('Error in authentication:', error);
        callback(error);
    }
}

module.exports = { authenticateUser }; 