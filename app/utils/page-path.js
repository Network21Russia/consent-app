'use strict'

const menu = require('../admin-menu');

function pagePath(activeMenuId, entityId = null, queryArgs) {
    let path = (menu[activeMenuId] || {path : ''}).path;

    entityId = entityId || null;
    if (entityId) {
        path += '/' + entityId
    }

    if (queryArgs) {
        path += '?';
        path += queryArgs.join('&');
        if (queryArgs.length) {
            path += '&';
        }
    }

    return path;
}

module.exports = pagePath;
