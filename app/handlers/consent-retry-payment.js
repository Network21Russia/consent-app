'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const createSberPayment = require("../utils/sber-payment");
const {
    getCustomersQuery,
    getConsentsQuery,
    getTicketsQuery,
    setConsentExternalOrderIdQuery,
} = require('../db/queries')

module.exports = async (ctx) => {
    ctx.state.title = 'Повторная попытка оплаты';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const consentId = ctx.params.consentId || '';
    if (!consentId) {
        ctx.throw(500);
    }

    const retryCount = +ctx.query.count || 1;


    let redirectUrl = `${config.publicHost}/customer/${hash}/${consentId}/paid-fail`

    let query = getCustomersQuery({hash: true});
    const db = DatabaseConnection.getInstance(config.db);

    await db.executeQuery("START TRANSACTION");

    try {

        let result = await db.executeQuery(query, [hash]);

        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const customer = result[0];

        query = getConsentsQuery({id: true}, 1, 0);
        result = await db.executeQuery(query, [consentId]);
        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const consent = result[0];

        if (consent.customer_id !== customer.id) {
            ctx.throw(500);
        }

        if (consent.payment_received) {
            return ctx.redirect(`/customer/${hash}/paid-success`);
        }

        query = getTicketsQuery({consent: true}, -1, 0);
        const consentTickets = await db.executeQuery(query, [consent.id]);

        result = await createSberPayment(config, customer, consent, consentTickets, retryCount)

        if (!result.formUrl) {
            ctx.log.warn(result, 'cannot create order at sber');


            if (retryCount > 10) {
                redirectUrl = `${config.publicHost}/customer/${hash}/${consentId}/paid-fail`
            } else {
                redirectUrl = `/customer/${hash}/${consent.id}/retry?count=${retryCount + 1}`
            }
        } else {

            query = setConsentExternalOrderIdQuery()
            await db.executeQuery(query, [result.orderId, consentId]);

            // redirect to sber
            redirectUrl = result.formUrl
        }

        ctx.redirect(redirectUrl);

    } catch (e) {
        ctx.log.error('rolling back transaction');
        await db.executeQuery("ROLLBACK");
        throw e;
    }

};
