// Vercel Serverless Catch-all Handler
const app = require('../server.js');

module.exports = (req, res) => {
  // Vercel injects a "...path" query param from the catch-all — strip it
  // The URL is already correct (/api/dashboard), just clean up the query
  const url = new URL(req.url, `http://${req.headers.host}`);
  url.searchParams.delete('...path');
  req.url = url.pathname + url.search;
  
  return app(req, res);
};
