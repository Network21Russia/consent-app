'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery, getCustomersCountQuery, insertEmailQuery, getTicketsIdWithoutCodes, getCodesToSend,
    getCodesToSendCount
} = require('../db/queries')
const menu = require('../admin-menu');
const {genderify, isMale, isFemale} = require('../utils/genderify');

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
            const idsWithConsents = await db.executeQuery(getTicketsIdWithoutCodes(true));

            if (idsWithConsents.length) {

                return ctx.render(template, {
                    finished: false,
                    started: false,
                    error: 'Загружено недостаточно кодов, чтобы начать рассылку'
                })
            }

            count = await sendConsentLetter(ctx, db, offset, itemsOnPage, hash);
        } else if (letter_type === 'code') {
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
    const codesToSend = await db.executeQuery(getCodesToSend(itemsOnPage, offset * itemsOnPage));

    const batch = [];
    const emailToCustomerId = {};
    const emailToConsentsId = {};

    for (const customer of codesToSend) {
        emailToCustomerId[customer.email] = customer.id;
        emailToConsentsId[customer.email] = customer.consents.split(',');
        batch.push({
            TemplateId: config.emailTemplateCodes,
            From: config.emailSenderFrom,
            To: customer.email,
            TemplateModel: {
                name: ([customer.name, customer.patronimic].filter(Boolean).join(' ')).trim(),
                gender: customer.gender,
                genderMale: isMale(customer.gender),
                genderFemale: isFemale(customer.gender),
                greeting: genderify(customer.gender, 'Уважаемый', 'Уважаемая'),
                codes: customer.codes.split(','),
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
        for (consentId of emailToConsentsId[r.To]) {
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
        with_rest: true
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
