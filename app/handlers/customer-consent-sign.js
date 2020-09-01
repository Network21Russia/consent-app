'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getTicketsQuery, getTicketsTotalsQuery, insertConsentQuery, setTicketsConsentQuery, insertEmailQuery} = require('../db/queries')
const renderPdf = require('../utils/render-pdf');
const {genderify, isMale, isFemale} = require('../utils/genderify');

module.exports = async (ctx, next) => {
    ctx.state.title = 'Согласие';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const selected_tickets = (ctx.request.body.ticket || []);

    let query = getCustomersQuery({hash: true, email_template: true});
    const db = DatabaseConnection.getInstance(config.db);

    try {

        await db.executeQuery("START TRANSACTION");

        const result = await db.executeQuery(query, [config.emailTemplateConsentRequest, hash]);

        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const customer = result[0];

        let template = 'consent-signed';
        if (customer.rest_tickets <= 0) {
            template = 'no-consent';

            return ctx.render(template, {
                customer: customer
            });
        }

        const ticketsFilter = {customer: true, has_no_consent: true, id: true};
        const params = [customer.id, selected_tickets]

        query = getTicketsQuery(ticketsFilter, -1, 0);
        const tickets = await db.executeQuery(query, params);

        if (!(Array.isArray(tickets))) {
            ctx.throw(500);
        }

        query = getTicketsTotalsQuery(ticketsFilter, -1, 0);
        const ticketsTotalsRes = await db.executeQuery(query, params);

        if (!(Array.isArray(ticketsTotalsRes) && ticketsTotalsRes.length)) {
            ctx.throw(500);
        }

        const ticketsTotals = ticketsTotalsRes[0];

        query = insertConsentQuery();
        const insertResult = await db.executeQuery(query,
            [customer.id, customer.email, customer.name, customer.surname, customer.patronimic]);

        const consentId = insertResult.insertId || 0;
        if (!consentId) {
            ctx.throw(500);
        }

        query = setTicketsConsentQuery();
        await db.executeQuery(query, [consentId, selected_tickets]);

        const rendered = await ctx.render('consent', {
            customer: customer,
            date: new Date(),
            consentSigner: config.consentSigner,
            isSignMode: true,
            tickets: tickets,
            ticketsTotals: ticketsTotals,
            layout: 'pdf',
            writeResp: false,
        })

        const fname = `consent-${consentId}.pdf`;

        const buffer = await renderPdf(rendered);

        const sendingOptions = {
            TemplateId: config.emailTemplateConsentPdf,
            From: config.emailSenderFrom,
            To: customer.email,
            TemplateModel: {
                name: ([customer.name, customer.patronimic].filter(Boolean).join(' ')).trim(),
                gender: customer.gender,
                genderMale: isMale(customer.gender),
                genderFemale: isFemale(customer.gender),
                greeting: genderify(customer.gender, 'Уважаемый', 'Уважаемая'),
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

        for (const r of sendingResult) {
            if (r.ErrorCode) {
                continue;
            }
            if (r.To === config.emailAdminEmail) {
                continue;
            }
            const query = insertEmailQuery();
            await db.executeQuery(query, [r.MessageID, customer.id, config.emailTemplateConsentPdf]);
        }

        await db.executeQuery("COMMIT");

        return ctx.render(template, {
            customer: customer
        });

    } catch (e) {
        ctx.log.error('rolling back transaction');
        await db.executeQuery("ROLLBACK");
        throw e;
    }


};
