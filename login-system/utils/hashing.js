const bcrypt = require('bcrypt');
const saltRounds = 10;

function hashPassword(plainTextPassword) {
    return bcrypt.hashSync(plainTextPassword, saltRounds);
}

module.exports = { hashPassword }; 