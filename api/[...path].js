// Vercel Serverless Catch-all Handler
// Vercel catch-all files strip the /api prefix from req.url.
// We must restore it so Express routes (/api/dashboard etc.) match correctly.
const app = require('../server.js');

module.exports = (req, res) => {
  // Vercel sets req.url to the path AFTER /api/, e.g. /dashboard
  // Express routes expect /api/dashboard, so prepend /api
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  return app(req, res);
};
