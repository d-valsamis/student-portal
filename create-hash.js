// create-hash.js
const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'your-new-password-here'; // Change this to your desired password
    const hash = await bcrypt.hash(password, 10);
    console.log('New password hash:');
    console.log(hash);
    console.log('\nReplace the ADMIN_PASSWORD_HASH in your .env file with this value');
}

generateHash();