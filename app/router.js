'use strict';

const Router = require('@koa/router');
const KoaBody = require('koa-body');

const config = require('../config/config');

const router = new Router();

router
    .get('/', async (ctx) => {
        ctx.redirect(config.officialSite);
    })

    .get('/logo.svg', require('./handlers/logo'))
    .get('/favicon.ico', require('./handlers/favicon'))
    .get('/robots.txt', require('./handlers/robots'))
    .get('/styles.css', require('./handlers/styles'))
    .get('/scripts.js', require('./handlers/scripts'))

    //.get('/customer/:hash', require('./handlers/customer-select-actions'))
    .post('/customer/:hash', KoaBody(), require('./handlers/customer-consent-sign'))
    .get('/customer/:hash/success', require('./handlers/customer-consent-success'))
    .get('/customer/:hash/:consentId/retry', require('./handlers/consent-retry-payment'))
    .get('/customer/:hash/paid', require('./handlers/customer-paid-consent-send'))
    .get('/customer/:hash/paid-success', require('./handlers/customer-paid-success'))
    .get('/customer/:hash/:consentId/paid-fail', require('./handlers/customer-paid-fail'))

    .get('/consent/template/:type', require('./handlers/consent-template'))

    .post('/webhook/delivered', KoaBody(), require('./handlers/webhook-email-delivered'))
    .post('/webhook/open', KoaBody(), require('./handlers/webhook-email-open'))

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
