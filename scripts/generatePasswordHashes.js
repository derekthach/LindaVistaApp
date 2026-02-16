#!/usr/bin/env node
/**
 * One-time script to generate bcrypt hashes for admin and employee passwords.
 * Use these hashes in login-system/users.json and login-system/server.js fallback.
 * Run: node scripts/generatePasswordHashes.js
 */

const SALT_ROUNDS = 10;
const ADMIN_PASSWORD = 'Rainw00d2023!';
const EMPLOYEE_PASSWORD = 'vistalinda';

function getBcrypt() {
  try {
    return require('bcrypt');
  } catch {
    return require('bcryptjs');
  }
}

function main() {
  try {
    const bcrypt = getBcrypt();
    const hashSync = bcrypt.hashSync || bcrypt.hash;
    if (typeof hashSync !== 'function') {
      throw new Error('No hashSync or hash function on bcrypt module');
    }
    const adminHash = hashSync(ADMIN_PASSWORD, SALT_ROUNDS);
    const employeeHash = hashSync(EMPLOYEE_PASSWORD, SALT_ROUNDS);
    console.log('ADMIN_HASH=' + adminHash);
    console.log('EMPLOYEE_HASH=' + employeeHash);
    process.exit(0);
  } catch (err) {
    console.error('Error generating hashes:', err.message);
    process.exit(1);
  }
}

main();
