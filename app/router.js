'use strict';

const Router = require('@koa/router');
const KoaBody = require('koa-body');

const config = require('../config/config');

const router = new Router();

router
    .get('/', async (ctx, next) => {
        ctx.redirect(config.officialSite);
    })

    .get('/customer/:hash', require('./handlers/customer-consent-view'))
    .post('/customer/:hash', KoaBody(), require('./handlers/customer-consent-sign'))

    .get('/admin', require('./handlers/admin-customers'))

    .get('/admin/consents', require('./handlers/admin-consents'))
    .get('/admin/consents/:id', require('./handlers/admin-consents'))

    .get('/admin/emails', require('./handlers/admin-emails'))
    .get('/admin/emails/:id', require('./handlers/admin-emails'))

    .get('/admin/send', require('./handlers/admin-send'))
    .get('/admin/send/:hash', require('./handlers/admin-send'))
;


module.exports = {
    routes: () => router.routes(),
    allowedMethods: () => router.allowedMethods(),
}
