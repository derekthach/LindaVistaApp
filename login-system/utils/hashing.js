const bcrypt = require('bcryptjs');
const saltRounds = 10;

function hashPassword(plainTextPassword) {
    return bcrypt.hashSync(plainTextPassword, saltRounds);
}

module.exports = { hashPassword }; 