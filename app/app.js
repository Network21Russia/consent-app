'use strict';

const Koa = require('koa');
const path = require('path');
const http = require('http');
const render = require('koa-ejs');
const mount = require('koa-mount');
const auth = require('koa-basic-auth');
const {KoaReqLogger} = require('koa-req-logger');
const cacheControl = require('koa-cache-control');
const shutdown = require('koa-graceful-shutdown');

const config = require('../config/config');
const router = require('./router');

function start(logger) {

    const koaLogger = new KoaReqLogger({
        pinoInstance: logger,
        alwaysError: true // treat all non-2** http codes as error records in logs
    });

    const app = new Koa();
    const server = http.createServer(app.callback());

    render(app, {
        root: path.join(__dirname, 'views'),
        layout: 'layout',
        viewExt: 'ejs',
        cache: true,
        debug: false,
        async: true,
    });

    app
        .use(koaLogger.getMiddleware())
        .use(async (ctx, next) => {
            try {
                ctx.state.officialSite = config.officialSite;
                ctx.state.title = 'Network TwentyOne';

                await next()
            } catch (err) {
                ctx.status = err.status || 500;
                if (err.status === 401) {
                    ctx.set('WWW-Authenticate', 'Basic');
                    ctx.body = 'Auth required';
                } else {
                    ctx.log.error(err)
                    return ctx.render('error');
                }
            }
        })
        .use(mount(config.adminRoutesNamespace, auth({name: config.adminLogin, pass: config.adminPassword})))
        .use(router.routes())
        .use(router.allowedMethods())
        .use(cacheControl({
            noCache: true
        }))
        .use(shutdown(server));

    server.listen(config.serverPort, '0.0.0.0', () => {
        const {address, port} = server.address();
        logger.info('listening on http://%s:%d', address, port);
    });

}

module.exports = {
    start: start,
};
