/**
 * Works out the public host and origin a request arrived on,
 * honouring the headers a reverse proxy sets in front of Dashy
 */

/* Proxy chains send a comma-separated list, the first entry is the original client-facing value */
const firstHeader = (req, name) => (req.headers[name] || '').split(',')[0].trim();

/* Hosts are case-insensitive, so always compare and emit them lowercased */
const hostFromRequest = (req) => (
  firstHeader(req, 'x-forwarded-host') || req.headers.host || 'localhost'
).toLowerCase();

const originFromRequest = (req) => {
  const proto = firstHeader(req, 'x-forwarded-proto') || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${hostFromRequest(req)}`;
};

module.exports = { hostFromRequest, originFromRequest };
