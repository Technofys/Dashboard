// Vercel Serverless Catch-all Handler
// This file handles all /api/* routes on Vercel by proxying to the Express app.
// Vercel catch-all files use [...path].js naming convention.
const app = require('../server.js');
module.exports = app;
