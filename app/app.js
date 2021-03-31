'use strict';

const fs = require('fs');
const Koa = require('koa');
const path = require('path');
const http = require('http');
const render = require('koa-ejs');
const mount = require('koa-mount');
const auth = require('koa-basic-auth');
const compress = require('koa-compress');
const sslify = require('koa-sslify').default;
const xForwardedProtoResolver  = require('koa-sslify').xForwardedProtoResolver ;
const minifier = require('koa-html-minifier');
const {KoaReqLogger} = require('koa-req-logger');
const cacheControl = require('koa-cache-control');
const shutdown = require('koa-graceful-shutdown');

const config = require('../config/config');
const declension = require('./utils/declension');
const {genderify} = require('./utils/genderify');
const {pluralize} = require('./utils/pluralize');
const {formatDate, formatDateTime} = require('./utils/format-date');
const formatMoney = require('./utils/format-money');
const router = require('./router');

const sslifyMiddleware = process.env.NODE_ENV === 'production'
    ? sslify({ resolver: xForwardedProtoResolver })
    : async (ctx, next) =>  next();

function start(logger) {

    const koaLogger = new KoaReqLogger({
        pinoInstance: logger,
        alwaysError: true // treat all non-2** http codes as error records in logs
    });

    const viewsDir = path.join(__dirname, 'views');
    const modifiedTimes = []
    fs.readdirSync(viewsDir).forEach(file => {
        const stats = fs.statSync(path.join(viewsDir, file));
        modifiedTimes.push(stats.mtime.getTime())
    });

    const lastModified = {
        'styles': Math.max(...modifiedTimes),
    }

    const staticDir = path.join(__dirname, '../static');
    fs.readdirSync(staticDir).forEach(file => {
        const stats = fs.statSync(path.join(staticDir, file));
        lastModified[path.parse(file).name] = stats.mtime.getTime();
    });

    const app = new Koa();
    const server = http.createServer(app.callback());

    render(app, {
        root: viewsDir,
        layout: 'layout',
        viewExt: 'ejs',
        cache: true,
        debug: false,
        async: true,
    });

    app
        .use(koaLogger.getMiddleware())
        .use(sslifyMiddleware)
        .use(compress({
            threshold: 2048,
            gzip: {
                flush: require('zlib').constants.Z_SYNC_FLUSH
            },
            deflate: {
                flush: require('zlib').constants.Z_SYNC_FLUSH,
            },
            br: {
                flush: require('zlib').constants.Z_SYNC_FLUSH,
            }
        }))
        .use(minifier({
            collapseWhitespace: true,
            preserveLineBreaks: false,
            useShortDoctype: true,
            decodeEntities: true,
            removeComments: true,
            minifyCSS: true,
            minifyJS: true,
        }))
        .use(cacheControl({
            noCache: true
        }))
        .use(async (ctx, next) => {
            try {
                ctx.state.officialSite = config.officialSite;
                ctx.state.title = 'Network TwentyOne';
                ctx.state.declension = declension;
                ctx.state.formatDate = formatDate;
                ctx.state.formatDateTime = formatDateTime;
                ctx.state.formatMoney = formatMoney;
                ctx.state.genderify = genderify;
                ctx.state.pluralize = pluralize;
                ctx.state.menu = {};
                ctx.state.lastModified = lastModified;

                await next()
            } catch (err) {
                ctx.status = err.status || 500;
                if (err.status === 401) {
                    ctx.set('WWW-Authenticate', 'Basic');
                    ctx.body = 'Auth required';
                } else {
                    ctx.log.error(err)
                    return ctx.render(ctx.status);
                }
            }
        })
        .use(mount(config.adminRoutesNamespace, auth({name: config.adminLogin, pass: config.adminPassword})))
        .use(router.routes())
        .use(router.allowedMethods())
        .use(async (ctx) => {
            ctx.status = 404;
            return ctx.render('404');
        })
        .use(shutdown(server));

    server.listen(config.serverPort, '0.0.0.0', () => {
        const {address, port} = server.address();
        logger.info('listening on http://%s:%d', address, port);
    });

}

module.exports = {
    start: start,
};
