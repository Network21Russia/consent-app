'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getTicketsQuery, getTicketsTotalsQuery, insertConsentQuery, setTicketsConsentQuery, insertEmailQuery, markConsentAsCodeSent} = require('../db/queries')
const renderPdf = require('../utils/render-pdf');
const composeTickets = require('../utils/compose-tickets');
const {genderify, isMale, isFemale} = require('../utils/genderify');
const declension = require('../utils/declension');
const formatMoney = require('../utils/format-money');
const {formatDate} = require('../utils/format-date');

module.exports = async (ctx, next) => {
    ctx.state.title = 'Соглашение';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const selected_tickets = (ctx.request.body.ticket || []);
    const editedSurname = (ctx.request.body.surname || '');
    const editedName = (ctx.request.body.name || '');
    const editedPatronimic = (ctx.request.body.patronimic || '');

    let query = getCustomersQuery({hash: true, email_template: true});
    const db = DatabaseConnection.getInstance(config.db);

    try {

        await db.executeQuery("START TRANSACTION");

        const result = await db.executeQuery(query, [config.emailTemplateConsentRequest, hash]);

        if (!(Array.isArray(result) && result.length)) {
            ctx.throw(500);
        }

        const customer = result[0];

        if (customer.rest_tickets <= 0) {
            const template = 'no-consent';

            return ctx.render(template, {
                customer: customer
            });
        }

        if (editedSurname) {
            customer.surname = editedSurname;
        }
        if (editedName) {
            customer.name = editedName;
        }
        if (editedPatronimic) {
            customer.patronimic = editedPatronimic;
        }

        const ticketsFilter = {customer: true, has_no_consent: true, id: true};
        const params = [customer.id, selected_tickets]

        query = getTicketsQuery(ticketsFilter, -1, 0);
        const tickets = await db.executeQuery(query, params);

        if (!(Array.isArray(tickets) && tickets.length)) {
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
            tickets: composeTickets(tickets),
            ticketsTotals: ticketsTotals,
            layout: 'pdf',
            styles_zoom: config.pdf_zoom_factor,
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

        let allowSendCodesImmediately = true;
        tickets.forEach(t => {
            if (t.code === null) {
                allowSendCodesImmediately = false
            }
        })

        if (allowSendCodesImmediately) {
            await db.executeQuery("START TRANSACTION");

            const totalTickets = tickets.length

            let totalAmount = 0
            const orders = Object.create(null);

            tickets.forEach(t => {
                totalAmount += t.amount

                orders[t.order_number] = orders[t.order_number] || {
                    order_number: t.order_number,
                    order_date: formatDate(t.order_date),
                    amount: 0,
                    count: 0,
                };

                orders[t.order_number].count++;
                orders[t.order_number].amount += t.amount;
            })

            const ordersData = Object.values(orders).map(order => {
                order.formattedAmount = formatMoney(order.amount, 0, 3, ' ', ',').trim();
                order.countDeclensed = declension(order.count, "билет", "билета", "билетов", {delimiter: ' '});
                return order;
            });

            const codesSendingOptions = {
                TemplateId: config.emailTemplateCodes,
                TrackLinks: 'none',
                From: config.emailSenderFrom,
                To: customer.email,
                TemplateModel: {
                    name: ([customer.name, customer.patronimic].filter(Boolean).join(' ')).trim(),
                    gender: customer.gender,
                    genderMale: isMale(customer.gender),
                    genderFemale: isFemale(customer.gender),
                    greeting: genderify(customer.gender, 'Уважаемый', 'Уважаемая'),
                    ordersData: ordersData,
                    consentsDeclensed: declension(1, "соглашение", "соглашения", "соглашений", {delimiter: ' '}),
                    codes: tickets.map((t, idx) => {
                        return {index: idx+1, code: t.code}
                    }),
                    codesDeclensed: declension(totalTickets, "код", "кода", "кодов", {delimiter: ' '}),
                    totalTickets: totalTickets,
                    totalTicketsDeclensed: declension(totalTickets, "штука", "штуки", "штук", {delimiter: ' '}),
                    formattedTotalAmount: formatMoney(totalAmount, 0, 3, ' ', ',').trim(),
                },
            }

            const sendingResult = await client.sendEmailBatchWithTemplates([codesSendingOptions]);

            const queryInsertEmail = insertEmailQuery();
            const queryMarkConsent = markConsentAsCodeSent();
            for (const r of sendingResult) {
                if (r.ErrorCode) {
                    continue;
                }
                await db.executeQuery(queryInsertEmail, [r.MessageID, customer.id, config.emailTemplateCodes]);
                await db.executeQuery(queryMarkConsent, [consentId]);
            }

            await db.executeQuery("COMMIT");
        }

        ctx.redirect(`/customer/${hash}/success`);

    } catch (e) {
        ctx.log.error('rolling back transaction');
        await db.executeQuery("ROLLBACK");
        throw e;
    }


};
