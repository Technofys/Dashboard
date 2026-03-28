// Vercel Serverless Function — re-exports the Express app
// Vercel automatically maps this file to /api/* routes
const app = require('../server.js');
module.exports = app;
