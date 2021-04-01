'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const renderPdf = require('../utils/render-pdf');
const {composeTickets, composeExchange, exchangeOptions} = require('../utils/compose-tickets');
const {getConsentsQuery, getCustomerByIdQuery, getTicketsQuery} = require('../db/queries');

module.exports = async (ctx, next) => {

    const consentId = (ctx.params.id || 0) * 1
    const offset = (ctx.query.offset || 0) * 1;

    const params = [];
    const filter = {};
    if (consentId) {
        filter.id = true;
        params.push(consentId)
    }

    let query = getConsentsQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(500);
    }

    const consent = result[0];

    query = getCustomerByIdQuery();
    const customerResult = await db.executeQuery(query, [consent.customer_id]);

    if (!(Array.isArray(customerResult) && customerResult.length)) {
        ctx.throw(500);
    }

    const customer = {
        surname: consent.signed_surname,
        name: consent.signed_name,
        patronimic: consent.signed_patronimic,
        email: consent.signed_email,
        gender: customerResult[0].gender,
    }

    const ticketsFilter = {consent: true};
    const ticketsQueryParams = [consentId]

    query = getTicketsQuery(ticketsFilter, -1, 0);
    const tickets = await db.executeQuery(query, ticketsQueryParams);

    if (!(Array.isArray(tickets))) {
        ctx.throw(500);
    }

    const rendered = await ctx.render('consent-' + consent.type, {
        isTemplate: false,
        consent: consent,
        customer: customer,
        consentSigner: config.consentSigner,
        composedTickets: composeTickets(tickets),
        composeExchange: composeExchange(tickets),
        exchangeOptions: exchangeOptions[consent.type],
        layout: 'pdf',
        styles_zoom: config.pdf_zoom_factor,
        writeResp: false,
    })

    const buffer = await renderPdf(rendered);

    const fname = `consent-${consent.consent_number}.pdf`;

    ctx.body = buffer;
    ctx.attachment(fname);

};
