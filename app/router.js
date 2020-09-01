'use strict';

const Router = require('@koa/router');
const KoaBody = require('koa-body');

const config = require('../config/config');

const router = new Router();

router
    .get('/', async (ctx, next) => {
        ctx.redirect(config.officialSite);
    })

    .get('/logo.png', require('./handlers/logo'))
    .get('/favicon.ico', require('./handlers/favicon'))
    .get('/robots.txt', require('./handlers/robots'))
    .get('/styles.css', require('./handlers/styles'))

    .get('/customer/:hash', require('./handlers/customer-consent-view'))
    .post('/customer/:hash', KoaBody(), require('./handlers/customer-consent-sign'))

    .post('/webhook/open', KoaBody(), require('./handlers/email-open-webhook'))

    .get('/admin', require('./handlers/admin-customers'))

    .get('/admin/consents', require('./handlers/admin-consents'))
    .get('/admin/consents/:id', require('./handlers/admin-consents'))

    .get('/admin/tickets', require('./handlers/admin-tickets'))
    .get('/admin/tickets/:id', require('./handlers/admin-tickets'))

    .get('/admin/data', require('./handlers/admin-data'))
    .post('/admin/data', KoaBody({multipart: true}), require('./handlers/admin-data'))

    .get('/admin/emails', require('./handlers/admin-emails'))
    .get('/admin/emails/:id', require('./handlers/admin-emails'))

    .get('/admin/send', require('./handlers/admin-send'))
    .get('/admin/send/:hash', require('./handlers/admin-send'))

    .get('/admin/pdf/:id', require('./handlers/admin-pdf'))
;


module.exports = {
    routes: () => router.routes(),
    allowedMethods: () => router.allowedMethods(),
}
