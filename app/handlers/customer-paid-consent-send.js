'use strict';

const SberbankAcquiring = require("sberbank-acq-no-module").default;
const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery,
    getTicketsQuery,
    insertEmailQuery,
    getConsentsQuery,
    markConsentAsPaid,
    ensureEmailSentQuery,
} = require('../db/queries')
const renderPdf = require('../utils/render-pdf');
const {composeTickets, composeExchange, exchangeOptions} = require('../utils/compose-tickets');


module.exports = async (ctx) => {
    ctx.state.title = 'Оплата прошла успешно';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const orderId = ctx.query.orderId || '';

    let redirectUrl = `${config.publicHost}/customer/${hash}/0/paid-fail`

    let query = getCustomersQuery({hash: true});
    const db = DatabaseConnection.getInstance(config.db);

    await db.executeQuery("START TRANSACTION");

    try {

        let result = await db.executeQuery(query, [hash]);

        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const customer = result[0];

        query = getConsentsQuery({externalOrderId: true}, 1, 0);
        result = await db.executeQuery(query, [orderId]);
        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const consent = result[0];

        if (consent.customer_id !== customer.id) {
            ctx.throw(500);
        }

        redirectUrl = `${config.publicHost}/customer/${hash}/${consent.id}/paid-fail`

        const sberbankAcquiring = new SberbankAcquiring({
            credentials: {
                username: config.sberbank.username,
                password: config.sberbank.password,
            },
            restConfig: {
                apiUri: config.sberbank.apiUri,
            },
        });

        const requestOptions = {
            orderId: orderId,
        }

        const sberResult = await sberbankAcquiring.getOrderStatusExtended(requestOptions);

        if (sberResult.orderStatus !== 2) {
            ctx.log.warn(sberResult, 'invalid order status at sber');
            return ctx.redirect(redirectUrl);
        }

        query = markConsentAsPaid();
        await db.executeQuery(query, [consent.id]);

        query = ensureEmailSentQuery()
        const sent = await db.executeQuery(query, [customer.id, config.emailTemplateConsentPdf]);
        if (!sent.length) {

            query = getTicketsQuery({consent: true}, -1, 0);
            const consentTickets = await db.executeQuery(query, [consent.id]);

            const rendered = await ctx.render('consent-' + consent.type, {
                isTemplate: false,
                consent: consent,
                customer: customer,
                consentSigner: config.consentSigner,
                composedTickets: composeTickets(consentTickets),
                composeExchange: composeExchange(consentTickets),
                exchangeOptions: exchangeOptions[consent.type],
                layout: 'pdf',
                styles_zoom: config.pdf_zoom_factor,
                writeResp: false,
            })

            const fname = `consent-${consent.consent_number}.pdf`;

            const buffer = await renderPdf(rendered);

            const sendingOptions = {
                TemplateId: config.emailTemplateConsentPdf,
                From: config.emailSenderFrom,
                To: customer.email,
                TrackLinks: 'none',
                TemplateModel: {
                    name: consent.signed_name,
                },
                Attachments: [
                    {
                        "Name": fname,
                        "Content": buffer.toString('base64'),
                        "ContentType": "application/pdf"
                    }
                ],
            };

            const sendingControlOptions = JSON.parse(JSON.stringify(sendingOptions));
            sendingControlOptions.To = config.emailAdminEmail;
            sendingControlOptions.TemplateModel.isAdminCopy = true;

            const client = new postmark.ServerClient(config.emailPostmarkToken);
            const sendingResult = await client.sendEmailBatchWithTemplates([sendingOptions, sendingControlOptions]);

            const queryInsertEmail = insertEmailQuery();

            for (const r of sendingResult) {
                if (r.ErrorCode) {
                    ctx.log.error(r.ErrorCode + ' ' + r.Message);
                    continue;
                }
                if (r.To === config.emailAdminEmail) {
                    continue;
                }

                await db.executeQuery(queryInsertEmail, [r.MessageID, customer.id, config.emailTemplateConsentPdf]);
            }
        }

        redirectUrl = `${config.publicHost}/customer/${hash}/paid-success`

        ctx.redirect(redirectUrl);

    } catch (e) {
        ctx.log.error('rolling back transaction');
        await db.executeQuery("ROLLBACK");
        throw e;
    }

};
