'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery} = require('../db/queries')

module.exports = async (ctx, next) => {

    ctx.state.title = 'Соглашение';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const query = getCustomersQuery({hash: true, email_template: true});
    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, [config.emailTemplateConsentRequest, hash]);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(404);
    }

    const customer = result[0];

    let template = 'consent';
    if (customer.rest_tickets <= 0) {
        template = 'no-consent';
    }

    return ctx.render(template, {
        customer: customer,
        consentSigner: config.consentSigner,
        isSignMode: false,
    })

};
