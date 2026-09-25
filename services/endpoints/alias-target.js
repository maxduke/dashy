/**
 * Resolves a request path like /jelly to the URL of the item that claims
 * that alias, so the server can redirect without the browser booting the app
 */

const configSchema = require('../../src/utils/config/ConfigSchema.json');
const { hostFromRequest } = require('../utils/request-origin');

/* Taken from the schema, so the server and the client can't disagree on what's reserved */
const RESERVED = configSchema.properties.sections.items
  .properties.items.items.properties.alias.not.enum;

/* Anything carrying visibility rules is left to the client, which can evaluate them */
const isUnrestricted = (entity) => !entity.displayData;

/* Only redirect somewhere absolute, browsable, and not back at this same path */
const isSafeTarget = (url, req) => {
  try {
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) return false;
    return target.host.toLowerCase() !== hostFromRequest(req)
      || target.pathname.replace(/\/+$/, '') !== req.path;
  } catch {
    return false;
  }
};

module.exports = (config, req) => {
  const alias = req.path.slice(1).toLowerCase();
  if (!alias || alias.includes('/') || RESERVED.includes(alias)) return undefined;
  const item = (config?.sections || [])
    .filter(isUnrestricted)
    .flatMap((section) => section.items || [])
    .find((i) => isUnrestricted(i) && String(i.alias || '').toLowerCase() === alias);
  return item && isSafeTarget(item.url, req) ? item.url : undefined;
};
