'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery,
    getTicketsQuery,
    insertConsentQuery,
    setTicketsConsentQuery,
    insertEmailQuery,
    markConsentAsCodeSent,
    getConsentsQuery,
} = require('../db/queries')
const renderPdf = require('../utils/render-pdf');
const {composeTickets, composeExchange, exchangeOptions, exchangeOptionsLetter} = require('../utils/compose-tickets');
const {genderify, isMale, isFemale} = require('../utils/genderify');
const declension = require('../utils/declension');
const formatMoney = require('../utils/format-money');
const {formatDate} = require('../utils/format-date');

const allowedConsentTypes = ['code', 'surcharge']

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
    const editedPassSerial = (ctx.request.body.pass_serial || '');
    const editedPassNumber = (ctx.request.body.pass_number || '');

    let query = getCustomersQuery({hash: true, email_template: true});
    const db = DatabaseConnection.getInstance(config.db);

    await db.executeQuery("START TRANSACTION");

    try {

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

        if (editedPassSerial) {
            customer.pass_serial = editedPassSerial;
        }

        if (editedPassNumber) {
            customer.pass_number = editedPassNumber;
        }

        const selected_tickets_ids = []
        const consentTypes = {}

        selected_tickets.forEach(t => {
            let [action, subAction, ticketId] = t.split('-');
            ticketId = ticketId * 1

            if (allowedConsentTypes.indexOf(action) < 0) {
                ctx.throw(500);
            }

            if (subAction < 1 || subAction > 3) {
                ctx.throw(500);
            }

            const fullAction = `${action}-${subAction}`

            consentTypes[action] = consentTypes[action] || {}
            consentTypes[action]['_all'] = consentTypes[action]['_all'] || {items: [], sum: 0, surcharge_sum: 0}
            consentTypes[action][fullAction] = consentTypes[action][fullAction] || {items: [], sum: 0, surcharge_sum: 0}
            consentTypes[action]['_all'].items.push(ticketId)
            consentTypes[action][fullAction].items.push(ticketId)

            selected_tickets_ids.push(ticketId)
        })

        const ticketsFilter = {customer: true, has_no_consent: true, id: true};
        const params = [customer.id, selected_tickets_ids]

        query = getTicketsQuery(ticketsFilter, -1, 0);
        const tickets = await db.executeQuery(query, params);

        if (!(Array.isArray(tickets) && tickets.length)) {
            ctx.throw(500);
        }

        const ticketsMap = tickets.reduce(function (accumulator, t) {
            accumulator[t.id] = t
            return accumulator
        }, {});

        const existingTicketsIds = Object.keys(ticketsMap)

        for (let consentType in consentTypes) {
            for (let action in consentTypes[consentType]) {
                if (!consentTypes[consentType].hasOwnProperty(action)) {
                    continue
                }
                consentTypes[consentType][action].items = consentTypes[consentType][action].items.filter(value => existingTicketsIds.includes(value))
                if (!consentTypes[consentType][action].items.length) {
                    delete consentTypes[consentType][action]
                    break
                }
                consentTypes[consentType][action].items.forEach(id => {
                    consentTypes[consentType][action].sum += ticketsMap[id].amount
                    consentTypes[consentType][action].surcharge_sum += ticketsMap[id].surcharge_amount
                })
            }
        }

        let redirectUrl = `/customer/${hash}/success`

        for (let consentType of allowedConsentTypes) {
            if (!consentTypes[consentType]) {
                continue
            }

            query = insertConsentQuery();
            const insertResult = await db.executeQuery(query,
                [customer.id, consentType, customer.email, customer.name, customer.surname, customer.patronimic, customer.pass_serial, customer.pass_number]);

            const consentId = insertResult.insertId || 0;
            if (!consentId) {
                ctx.throw(500);
            }

            consentTypes[consentType]['_consentId'] = consentId

            for (let action in consentTypes[consentType]) {
                if (!consentTypes[consentType].hasOwnProperty(action)) {
                    continue
                }

                if (action.startsWith('_')) {
                    continue
                }

                query = setTicketsConsentQuery();
                await db.executeQuery(query, [consentId, action, consentTypes[consentType][action].items]);
            }

            query = getConsentsQuery({id: true}, 1, 0);
            const result = await db.executeQuery(query, [consentId]);
            const consent = result[0];

            query = getTicketsQuery({consent: true}, -1, 0);
            const consentTickets = await db.executeQuery(query, [consentId]);

            const composedExchangeData = composeExchange(consentTickets)

            if (consentType === 'code') {
                const rendered = await ctx.render('consent-' + consentType, {
                    isTemplate: false,
                    consent: consent,
                    customer: customer,
                    consentSigner: config.consentSigner,
                    composedTickets: composeTickets(consentTickets),
                    composeExchange: composedExchangeData,
                    exchangeOptions: exchangeOptions[consentType],
                    layout: 'pdf',
                    styles_zoom: config.pdf_zoom_factor,
                    writeResp: false,
                })

                const fname = `consent-${consent.consent_number}.pdf`;

                const buffer = await renderPdf(rendered);

                const codesGroups = composedExchangeData.reduce(function (accumulator, current) {
                    accumulator[current.action] = accumulator[current.action] || {
                        title: exchangeOptionsLetter[current.action],
                        codes: current.codes.map((c, idx) => {
                            return {index: idx + 1, code: c}
                        })
                    }
                    return accumulator;
                }, {});

                const sendingOptions = {
                    TemplateId: config.emailTemplateCodes,
                    From: config.emailSenderFrom,
                    // To: customer.email,
                    To: 'james.kotoff@gmail.com',
                    TrackLinks: 'none',
                    TemplateModel: {
                        name: consent.signed_name,
                        gender: customer.gender,
                        genderMale: isMale(customer.gender),
                        genderFemale: isFemale(customer.gender),
                        codesGroups: codesGroups,
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
                    await db.executeQuery(query, [r.MessageID, customer.id, config.emailTemplateCodes]);
                }

                continue
            }

            if (consentType === 'code') {
                // redirect to sber
                // redirectUrl = 'path to sber'
            }
        }

        await db.executeQuery("COMMIT");

        ctx.redirect(`/customer/${hash}/success`);

    } catch (e) {
        ctx.log.error('rolling back transaction');
        await db.executeQuery("ROLLBACK");
        throw e;
    }


};
