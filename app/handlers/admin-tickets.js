'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getTicketsQuery, getTicketsTotalsQuery} = require('../db/queries')
const menu = require('../admin-menu');
const pagePath = require('../utils/page-path');

module.exports = async (ctx, next) => {

    ctx.state.title = 'Отчет по билетам';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'tickets';

    const customerId = (ctx.params.id || 0) * 1
    const offset = (ctx.query.offset || 0) * 1;
    const hasConsent = (ctx.query.hasConsent || 0) * 1;
    const search = ctx.query.search || '';

    const params = [];
    const filter = {with_customers: true};
    const filter_query = [];

    if (customerId) {
        filter.customer = true;
        params.push(customerId)
    }

    if (hasConsent) {
        filter_query.push(`hasConsent=${hasConsent}`)
        if (hasConsent === 1) {
            filter.has_consent = true;
        } else if (hasConsent === 2) {
            filter.has_no_consent = true;
        }
    }

    if (search) {
        filter_query.push(`search=${encodeURIComponent(search)}`)
        filter.with_search = true;
        params.push(`%${search}%`);
    }

    let query = getTicketsQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result))) {
        ctx.throw(500);
    }

    query = getTicketsTotalsQuery(filter);
    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    const template = 'admin-tickets';
    const totalCount = count[0].count;


    return ctx.render(template, {
        tickets: result,
        customerId: customerId,
        total: totalCount,
        itemsOnPage: config.itemsOnPage,
        showPagination: totalCount > config.itemsOnPage,
        pages: Math.ceil(totalCount / config.itemsOnPage),
        currentPage: offset,
        formAction: pagePath(ctx.state.activeMenu, customerId),
        pagePath: pagePath(ctx.state.activeMenu, customerId, filter_query),
        hasConsent: hasConsent,
        search: search,
        hasFilters: filter_query.length > 0,
    })

};
