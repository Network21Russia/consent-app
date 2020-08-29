'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getEmailsQuery, getEmailsCountQuery} = require('../db/queries')
const menu = require('../admin-menu');

module.exports = async (ctx, next) => {

    ctx.state.title = 'Отчет по письмам';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'emails';

    const customerId = (ctx.params.id || 0) * 1
    const offset = (ctx.query.offset || 0) * 1;
    const mailTemplate = (ctx.query.template || 0) * 1;
    const isOpen = (ctx.query.isOpen || 0) * 1;

    const params = [];
    const filter = {};
    const filter_query = [];

    if (customerId) {
        filter.id = true;
        params.push(customerId)
    }

    if (mailTemplate) {
        filter_query.push(`template=${mailTemplate}`)
        filter.template = true;
        params.push(mailTemplate)
    }

    if (isOpen) {
        filter_query.push(`isOpen=${isOpen}`)
        filter.isOpen = true;
        params.push(isOpen == 1 ? 0 : 1 )
    }

    let query = getEmailsQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result))) {
        ctx.throw(500);
    }

    query = getEmailsCountQuery(filter)
    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    const template = 'admin-emails';
    const totalCount = count[0].count;

    const emailTemplateNames = {};
    emailTemplateNames[config.emailTemplateConsentRequest] = 'Запрос соглашения';
    emailTemplateNames[config.emailTemplateConsentPdf] = 'Отправка PDF';

    return ctx.render(template, {
        emails: result,
        customerId: customerId,
        total: totalCount,
        itemsOnPage: config.itemsOnPage,
        showPagination: totalCount > config.itemsOnPage,
        pages: Math.ceil(totalCount / config.itemsOnPage),
        currentPage: offset,
        filter_query: '?' + filter_query.join('&'),
        template: mailTemplate,
        isOpen: isOpen,
        emailTemplateConsentRequest: config.emailTemplateConsentRequest,
        emailTemplateConsentPdf: config.emailTemplateConsentPdf,
        emailTemplateNames: emailTemplateNames,
    })

};
