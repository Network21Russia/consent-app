'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getTicketsQuery, getTicketsTotalsQuery} = require('../db/queries')

module.exports = async (ctx) => {

    ctx.state.title = 'Соглашение';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    let query = getCustomersQuery({hash: true, email_template: true});
    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, [config.emailTemplateConsentRequest, hash]);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(404);
    }

    const customer = result[0];

    let tickets = [];
    let ticketsTotals = {};

    let template = 'select-actions';
    if (customer.rest_tickets <= 0) {
        template = 'no-consent';
    } else {
        const ticketsFilter = {customer: true, has_no_consent: true};

        query = getTicketsQuery(ticketsFilter, -1, 0);
        tickets = await db.executeQuery(query, [customer.id]);

        if (!(Array.isArray(tickets))) {
            ctx.throw(500);
        }

        query = getTicketsTotalsQuery(ticketsFilter, -1, 0);
        const ticketsTotalsRes = await db.executeQuery(query, [customer.id]);

        if (!(Array.isArray(ticketsTotalsRes) && ticketsTotalsRes.length)) {
            ctx.throw(500);
        }

        ticketsTotals = ticketsTotalsRes[0];
    }

    return ctx.render(template, {
        customer: customer,
        date: new Date(),
        consentSigner: config.consentSigner,
        isSignMode: false,
        tickets: tickets,
        hasManyTickets: tickets.length > 1,
        ticketsTotals: ticketsTotals,
    })

};
