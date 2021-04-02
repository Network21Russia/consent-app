'use strict';

const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    getCustomersQuery, getCustomersCountQuery, insertEmailQuery, getTicketsTotalsQuery,
} = require('../db/queries')
const menu = require('../admin-menu');
const declension = require('../utils/declension');
const formatMoney = require('../utils/format-money');
const {genderify} = require('../utils/genderify');

module.exports = async (ctx) => {

    const itemsOnPage = 500;

    ctx.state.title = 'Рассылка';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'send';

    const hash = ctx.params.hash || '';
    const offset = +ctx.query.offset || 0;
    const started = +ctx.query.started || 0;
    const total = +ctx.query.total || 0;
    const letter_type = ctx.query.letter_type || '';

    const filter_query = [];

    let totalCount = 0;
    let finished = false;

    const template = 'admin-send';

    if (started && letter_type) {

        const db = DatabaseConnection.getInstance(config.db);

        let count

        if (letter_type === 'consent') {
            count = await sendConsentRequestLetter(ctx, db, offset, itemsOnPage, hash);
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

async function sendConsentRequestLetter(ctx, db, offset, itemsOnPage, hash) {
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

        const ticketsFilter = {customer: true, has_no_consent: true};

        query = getTicketsTotalsQuery(ticketsFilter, -1, 0);
        const ticketsTotalsRes = await db.executeQuery(query, [customer.id]);

        if (!(Array.isArray(ticketsTotalsRes) && ticketsTotalsRes.length)) {
            continue
        }

        const ticketsTotals = ticketsTotalsRes[0];

        batch.push({
            TemplateId: config.emailTemplateConsentRequest,
            From: config.emailSenderFrom,
            To: customer.email,
            TemplateModel: {
                name: ([customer.name, customer.surname].filter(Boolean).join(' ')).trim(),
                greeting: genderify(customer.gender, 'Уважаемый', 'Уважаемая'),
                url: `https://${config.publicHost}/customer/${customer.url_hash}`,
                formattedSum: formatMoney(ticketsTotals.sum, 0, 3, ' ', ',').trim(),
                count: ticketsTotals.count,
                hasManyTickets: ticketsTotals.count > 1,
                hasOneTicket: ticketsTotals.count <= 1,
                declensedTickets: declension(ticketsTotals.count, "билет", "билета", "билетов", {printCount: false})
            },
        });
    }

    const client = new postmark.ServerClient(config.emailPostmarkToken);
    const sendingResult = await client.sendEmailBatchWithTemplates(batch);

    query = insertEmailQuery();
    for (const r of sendingResult) {
        if (r.ErrorCode) {
            continue;
        }
        await db.executeQuery(query, [r.MessageID, emailToCustomerId[r.To], config.emailTemplateConsentRequest]);
    }

    query = getCustomersCountQuery(filter);

    const count = await db.executeQuery(query, params);
    if (!(Array.isArray(count))) {
        ctx.throw(500);
    }

    return count

}
