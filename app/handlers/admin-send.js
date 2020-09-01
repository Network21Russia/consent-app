'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getCustomersCountQuery, insertEmailQuery} = require('../db/queries')
const menu = require('../admin-menu');
const {genderify, isMale, isFemale} = require('../utils/genderify');

module.exports = async (ctx, next) => {

    const itemsOnPage = 500;

    ctx.state.title = 'Рассылка';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'send';

    const hash = ctx.params.hash || '';
    const offset = (ctx.query.offset || 0) * 1;
    const started = (ctx.query.started || 0) * 1;
    const total = (ctx.query.total || 0) * 1;

    const filter_query = [];

    let totalCount = 0;
    let finished = false;

    if (started) {

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

        const db = DatabaseConnection.getInstance(config.db);
        const result = await db.executeQuery(query, params);

        if (!(Array.isArray(result))) {
            ctx.throw(500);
        }

        const batch = [];
        const emailToCustomerId = {};

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

        totalCount = total ? total : (count[0] ? count[0].count : 0);

        filter_query.push('started=' + started);
        filter_query.push('total=' + totalCount);
        filter_query.push('offset=' + (offset + 1));

        const totalPages = Math.ceil(totalCount / itemsOnPage);

        finished = totalPages <= offset;
    }

    const template = 'admin-send';

    return ctx.render(template, {
        finished: finished,
        started: !!started,
        hash: hash,
        filter_query: '?' + filter_query.join('&')
    })

};
