'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, insertConsentQuery} = require('../db/queries')

module.exports = async (ctx, next) => {
    ctx.state.title = 'Соглашение';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const tickets_count = (ctx.request.body.tickets_count || 0) * 1;

    let query = getCustomersQuery({hash: hash});
    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, [hash]);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(500);
    }

    const customer = result[0];

    let template = 'consent_signed';
    if (customer.rest_tickets <= 0) {
        template = 'no_consent';

        return ctx.render(template, {
            customer: customer
        });

    } else {
        if (tickets_count < customer.rest_tickets) {
            customer.rest_tickets = tickets_count
        }
    }

    query = insertConsentQuery({hash: hash});
    await db.executeQuery(query,
        [customer.id, customer.email, customer.name, customer.surname, customer.patronimic, customer.rest_tickets]);

    const rendered = await ctx.render('consent', {
        customer: customer,
        consentSigner: config.consentSigner,
        isSignMode: true,
        layout: false,
        writeResp: false,
    })

    // console.log(rendered);
    // todo: create and sign pdf,
    // todo: send email

    return ctx.render(template, {
        customer: customer
    });

};
