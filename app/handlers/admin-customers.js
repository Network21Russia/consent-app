'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getCustomersCountQuery} = require('../db/queries')
const menu = require('../admin-menu');
const pagePath = require('../utils/page-path');

module.exports = async (ctx) => {

    ctx.state.title = 'Отчет по покупателям';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'customers';

    const offset = (ctx.query.offset || 0) * 1;
    const ticketsRest = (ctx.query.ticketsRest || 0) * 1;
    const letters = (ctx.query.letters || 0) * 1;
    const consent = (ctx.query.consent || 0) * 1;
    const search = ctx.query.search || '';
    const filter_query = [];

    const filter = {
        email_template: true
    };
    const params = []
    params.push(config.emailTemplateConsentRequest);

    if (ticketsRest) {
        filter_query.push(`ticketsRest=${ticketsRest}`)
        if (ticketsRest === 1) {
            filter.with_rest = true;
        } else if (ticketsRest === 2) {
            filter.without_rest = true;
        }
    }

    if (search) {
        filter_query.push(`search=${encodeURIComponent(search)}`)
        filter.with_search = true;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (letters) {
        filter_query.push(`letters=${letters}`)
        if (letters === 1) {
            filter.letter_not_send = true;
        } else if (letters === 2) {
            filter.letter_send = true;
        } else if (letters === 3) {
            filter.letter_opened = true;
        } else if (letters === 4) {
            filter.letter_not_delivered = true;
        } else if (letters === 5) {
            filter.letter_delivered = true;
        }
    }

    if (consent) {
        filter_query.push(`consent=${consent}`)
        if (consent === 1) {
            filter.without_consent = true;
        } else if (consent === 2) {
            filter.with_consent = true;
        }
    }

    let query = getCustomersQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result))) {
        ctx.throw(500);
    }

    query = getCustomersCountQuery(filter);

    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    const template = 'admin-customers';
    const totalCount = count[0].count;

    return ctx.render(template, {
        customers: result,
        total: totalCount,
        itemsOnPage: config.itemsOnPage,
        showPagination: totalCount > config.itemsOnPage,
        pages: Math.ceil(totalCount / config.itemsOnPage),
        currentPage: offset,
        ticketsRest: ticketsRest,
        letters: letters,
        consent: consent,
        search: search,
        formAction: pagePath(ctx.state.activeMenu, null),
        pagePath: pagePath(ctx.state.activeMenu, null, filter_query),
        hasFilters: filter_query.length > 0,
    })

};
