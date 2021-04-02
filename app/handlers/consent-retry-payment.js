'use strict';

const SberbankAcquiring = require("sberbank-acq").default;
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery,
    getConsentsQuery,
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


    let redirectUrl = `${config.publicHost}/customer/${hash}/paid-fail`

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

        const sberbankAcquiring = new SberbankAcquiring({
            credentials: {
                username: config.sberbank.username,
                password: config.sberbank.password,
            },
            restConfig: {
                apiUri: config.sberbank.apiUri,
            },
        });

        const registerOptions = {
            amount: consent.consent_tickets_surcharge_amount * 100,
            currency: '643',
            language: 'ru',
            orderNumber: `C-${consent.consent_number}`,
            returnUrl: `${config.publicHost}/customer/${hash}/paid`,
            failUrl: `${config.publicHost}/customer/${hash}/paid-fail`,
            description: `Доплата по Соглашению №${consent.consent_number}`,
            taxSystem: 1,
        }

        result = await sberbankAcquiring.register(registerOptions);

        if (!result.formUrl) {
            ctx.log.warn(result, 'cannot create order at sber');
            const retryCount = +ctx.query.count || 1;

            if (retryCount > 10) {
                redirectUrl = `${config.publicHost}/customer/${hash}/paid-fail`
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
