// Catch-all serverless function forwarding to unified Express API
const app = require('./index');

module.exports = (req, res) => {
  return app(req, res);
};
