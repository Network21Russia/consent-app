'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery, getCustomersCountQuery, insertEmailQuery, getTicketsIdWithoutCodes, getCodesToSend,
    getCodesToSendCount, markConsentAsCodeSent
} = require('../db/queries')
const menu = require('../admin-menu');
const {genderify, isMale, isFemale} = require('../utils/genderify');
const declension = require('../utils/declension');
const formatMoney = require('../utils/format-money');

module.exports = async (ctx) => {

    const itemsOnPage = 500;

    ctx.state.title = 'Рассылка';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'send';

    const hash = ctx.params.hash || '';
    const offset = (ctx.query.offset || 0) * 1;
    const started = (ctx.query.started || 0) * 1;
    const total = (ctx.query.total || 0) * 1;
    const letter_type = ctx.query.letter_type || '';

    const filter_query = [];

    let totalCount = 0;
    let finished = false;

    const template = 'admin-send';

    if (started && letter_type) {

        const db = DatabaseConnection.getInstance(config.db);

        let count

        if (letter_type === 'consent') {
            count = await sendConsentLetter(ctx, db, offset, itemsOnPage, hash);
        } else if (letter_type === 'code') {
            const idsWithConsents = await db.executeQuery(getTicketsIdWithoutCodes(true));

            if (idsWithConsents.length) {

                return ctx.render(template, {
                    finished: false,
                    started: false,
                    error: 'Загружено недостаточно кодов, чтобы начать рассылку'
                })
            }

            count = await sendCodeLetter(ctx, db, offset, itemsOnPage);
        } else {
            ctx.throw(500);
        }

        totalCount = total ? total : (count[0] ? count[0].count : 0);

        filter_query.push('started=' + started);
        filter_query.push('total=' + totalCount);
        filter_query.push('offset=' + (offset + 1));
        filter_query.push('letter_type=' + letter_type);

        const totalPages = Math.ceil(totalCount / itemsOnPage);

        finished = hash ? true : totalPages <= offset;
    }

    return ctx.render(template, {
        finished: finished,
        started: !!started,
        hash: hash,
        filter_query: '?' + filter_query.join('&'),
        error: ''
    })

};

async function sendCodeLetter(ctx, db, offset, itemsOnPage) {
    db.pool.on('connection', function (connection) {
        connection.query('SET SESSION group_concat_max_len = 10000000')
    });
    const codesToSend = await db.executeQuery(getCodesToSend(itemsOnPage, offset * itemsOnPage));

    const batch = [];
    const emailToCustomerId = {};
    const emailToConsentsId = {};

    for (const customer of codesToSend) {
        let consents = [];
        let totalAmount = 0;
        let totalTickets = 0;
        const orders = Object.create(null);
        const codes = [];

        const data = JSON.parse('[' + customer.data + ']');

        for (let item of data) {
            consents.push(item.consent_id);

            codes.push(item.code);

            totalTickets++;
            totalAmount += item.amount;

            orders[item.order_number] = orders[item.order_number] || {
                order_number: item.order_number,
                order_date: item.order_date,
                amount: 0,
                count: 0,
            };

            orders[item.order_number].count++;
            orders[item.order_number].amount += item.amount;
        }

        consents = Array.from(new Set(consents));

        const ordersData = Object.values(orders).map(order => {
            order.formattedAmount = formatMoney(order.amount, 0, 3, ' ', ',').trim();
            order.countDeclensed = declension(order.count, "билет", "билета", "билетов", {delimiter: ' '});
            return order;
        });

        emailToCustomerId[customer.email] = customer.customer_id;
        emailToConsentsId[customer.email] = consents;

        batch.push({
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
                consentsDeclensed: declension(consents.length, "соглашение", "соглашения", "соглашений", {delimiter: ' '}),
                codes: codes.map((code, idx) => {
                    return {index: idx+1, code: code}
                }),
                codesDeclensed: declension(codes.length, "код", "кода", "кодов", {delimiter: ' '}),
                totalTickets: totalTickets,
                totalTicketsDeclensed: declension(totalTickets, "штука", "штуки", "штук", {delimiter: ' '}),
                formattedTotalAmount: formatMoney(totalAmount, 0, 3, ' ', ',').trim(),
            },
        });
    }

    const client = new postmark.ServerClient(config.emailPostmarkToken);
    const sendingResult = await client.sendEmailBatchWithTemplates(batch);

    const queryInsertEmail = insertEmailQuery();
    const queryMarkConsent = markConsentAsCodeSent();
    for (const r of sendingResult) {
        if (r.ErrorCode) {
            continue;
        }

        await db.executeQuery(queryInsertEmail, [r.MessageID, emailToCustomerId[r.To], config.emailTemplateCodes]);
        for (let consentId of emailToConsentsId[r.To]) {
            await db.executeQuery(queryMarkConsent, [consentId]);
        }
    }

    const count = await db.executeQuery(getCodesToSendCount());
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    return count
}

async function sendConsentLetter(ctx, db, offset, itemsOnPage, hash) {
    const batch = [];
    const emailToCustomerId = {};

        const params = [config.emailTemplateConsentRequest];
        const filter = {
            email_template: true,
            without_consent: true
        };

    if (hash) {
        filter.hash = true;
        params.push(hash);
    }

    let query = getCustomersQuery(filter, itemsOnPage, offset * itemsOnPage);


    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result))) {
        ctx.throw(500);
    }

    for (const customer of result) {
        emailToCustomerId[customer.email] = customer.id;
        batch.push({
            TemplateId: config.emailTemplateConsentRequest,
            From: config.emailSenderFrom,
            To: customer.email,
            TemplateModel: {
                name: ([customer.name, customer.patronimic].filter(Boolean).join(' ')).trim(),
                gender: customer.gender,
                genderMale: isMale(customer.gender),
                genderFemale: isFemale(customer.gender),
                greeting: genderify(customer.gender, 'Уважаемый', 'Уважаемая'),
                host: config.publicHost,
                path: `/customer/${customer.url_hash}`,
                url: `https://${config.publicHost}/customer/${customer.url_hash}`,
            },
        });
    }

    const client = new postmark.ServerClient(config.emailPostmarkToken);
    const sendingResult = await client.sendEmailBatchWithTemplates(batch);

    for (const r of sendingResult) {
        if (r.ErrorCode) {
            continue;
        }
        const query = insertEmailQuery();
        await db.executeQuery(query, [r.MessageID, emailToCustomerId[r.To], config.emailTemplateConsentRequest]);
    }

    query = getCustomersCountQuery(filter);

    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    return count

}
