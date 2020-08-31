'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getConsentsQuery, getConsentsCountQuery} = require('../db/queries')
const menu = require('../admin-menu');
const pagePath = require('../utils/page-path');

module.exports = async (ctx, next) => {

    ctx.state.title = 'Отчет по согласиям';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'consents';

    const customerId = (ctx.params.id || 0) * 1
    const offset = (ctx.query.offset || 0) * 1;

    const params = [];
    const filter = {};
    if (customerId) {
        filter.customer_id = true;
        params.push(customerId)
    }

    let query = getConsentsQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result))) {
        ctx.throw(500);
    }

    query = getConsentsCountQuery(filter)
    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    const template = 'admin-consents';
    const totalCount = count[0].count

    return ctx.render(template, {
        consents: result,
        total: totalCount,
        itemsOnPage: config.itemsOnPage,
        showPagination: totalCount > config.itemsOnPage,
        pages: Math.ceil(totalCount / config.itemsOnPage),
        currentPage: offset,
        pagePath: pagePath(ctx.state.activeMenu, null, []),
    })

};
