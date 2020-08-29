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

    .get('/admin', async (ctx, next) => {
        return ctx.render('admin', {
            attributes: []
        })
    })
;


module.exports = {
    routes: () => router.routes(),
    allowedMethods: () => router.allowedMethods(),
}
