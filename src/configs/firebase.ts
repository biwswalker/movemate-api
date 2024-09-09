import admin from 'firebase-admin'

export function initializeFirebase() {
  const serviceAccount = require('../../firebase-services.json')
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('🔥 Configured Firebase')
}

export default admin