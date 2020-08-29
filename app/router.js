'use strict';

const Router = require('@koa/router');
const KoaBody = require('koa-body');
const convert = require('koa-convert');
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../config/config');

const router = new Router();
const koaBody = convert(KoaBody({
    multipart: true
}));


router
    .get('/admin', async (ctx, next) => {
        return ctx.render('admin', {
            attributes: []
        })
    })

    .get('/', async (ctx, next) => {
        // ctx.router available
        const db = DatabaseConnection.getInstance(config.db);
        const query = 'select * from customers';
        const result = await db.executeQuery(query, {});
        return ctx.render('index', {
            attributes: []
        })
    });


module.exports = {
    routes: () => router.routes(),
    allowedMethods: () => router.allowedMethods(),
}
