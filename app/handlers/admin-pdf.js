'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const renderPdf = require('../utils/render-pdf');
const {getConsentsQuery, getCustomerByIdQuery, getTicketsQuery, getTicketsTotalsQuery} = require('../db/queries');

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

    query = getTicketsTotalsQuery(ticketsFilter, -1, 0);
    const ticketsTotalsRes = await db.executeQuery(query, ticketsQueryParams);

    if (!(Array.isArray(ticketsTotalsRes) && ticketsTotalsRes.length)) {
        ctx.throw(500);
    }

    const ticketsTotals = ticketsTotalsRes[0];

    const rendered = await ctx.render('consent', {
        customer: customer,
        date: consent.datetime,
        consentSigner: config.consentSigner,
        isSignMode: true,
        tickets: tickets,
        ticketsTotals: ticketsTotals,
        layout: 'pdf',
        writeResp: false,
    })

    const buffer = await renderPdf(rendered);

    const fname = `consent-${consentId}.pdf`;

    ctx.body = buffer;
    ctx.attachment(fname);

};
