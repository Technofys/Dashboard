// Vercel Serverless Catch-all Handler
// Debug: log what Vercel passes as req.url
const app = require('../server.js');

module.exports = (req, res) => {
  // Debug: check what URL Vercel actually passes
  const originalUrl = req.url;
  
  // Vercel catch-all strips /api prefix — restore it
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }
  
  // Add debug header so we can see what happened
  res.setHeader('X-Debug-Original-Url', originalUrl);
  res.setHeader('X-Debug-Fixed-Url', req.url);
  
  return app(req, res);
};
