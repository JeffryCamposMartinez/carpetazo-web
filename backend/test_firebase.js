const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp({
  projectId: 'carpetazo-db9d7'
});

console.log('App initialized');

getAuth().verifyIdToken('dummy').catch(err => console.error('Caught:', err.message));
