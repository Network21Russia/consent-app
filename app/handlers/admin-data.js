'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const postmark = require("postmark");
const xlsx = require('node-xlsx').default;
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    insertCustomerQuery, getCustomerByEmailQuery, insertTicketsQuery, fillCodesTable, getTicketsQuery,
    filterNewCustomers, insertEmailQuery, getUnusedCodes, getTicketsTotalsQuery
} = require('../db/queries')
const {genderify} = require('../utils/genderify');
const menu = require('../admin-menu');
const pagePath = require('../utils/page-path');

const allowedDelimiters = [',', ';'];
const allowedCharsets = ['win1251', 'utf8'];
const delimetersNames = {
    ',': 'запятая',
    ';': 'точка с запятой',
}

const surnameCompletions = {
    female: ['ова', 'ева', 'ина', 'ая', 'яя', 'екая', 'цкая'],
    male: ['ов', 'ев', 'ин', 'ын', 'ой', 'цкий', 'ский', 'цкой', 'ской']
}

const codesNames = {
    1: 'Коды на 3 месяца Лидерской-Плюс подписки',
    2: 'Коды на 4 месяца Лидерской подписки',
    3: 'Коды на 6 месяцев Партнерской подписки',
}

const surcharges = {
    3700: 200,
    4000: 500,
}

const codesTypes = Object.keys(codesNames).map(c => +c)

function getGender(dict, name, surname) {

    const nameLc = name.toLowerCase();
    const surnameLc = surname.toLowerCase();

    if (dict.hasOwnProperty(nameLc)) {
        return dict[nameLc]
    }
    // fallback на случай если в таблице перепутаны местами имя и фамилия
    if (dict.hasOwnProperty(surnameLc)) {
        return dict[surnameLc]
    }

    for (let gender of Object.keys(surnameCompletions)) {
        for (let suffix of surnameCompletions[gender]) {
            if (surnameLc.endsWith(suffix)) {
                return gender
            }
        }
    }

    for (let gender of Object.keys(surnameCompletions)) {
        for (let suffix of surnameCompletions[gender]) {
            if (nameLc.endsWith(suffix)) {
                return gender
            }
        }
    }

    // по статистике прошлых заказов, 60% покупателей билетов - женщины
    // поэтому если не удалось определить пол никаким способом, то возвращаем по умолчанию женский
    return 'female'
}


module.exports = async (ctx) => {

    ctx.state.title = 'Данные';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'data';

    const template = 'admin-data';

    let parsedRowsCount = 0;
    let addedOrdersCount = 0;
    let addedCodesCount = 0;
    let lettersSendCount = 0;
    let needMoreCodes = false;
    let uploadSuccess = null;
    let resetSuccess = null;

    const db = DatabaseConnection.getInstance(config.db);

    // const hasCustomers = (await db.executeQuery("SELECT COUNT(id) AS cnt FROM customers"))[0].cnt > 0;

    if (ctx.request.method === 'POST') {

        await db.executeQuery("START TRANSACTION");

        try {

            if (ctx.request.body.reset && ctx.request.body.reset === '1') {

                resetSuccess = false;

                const tables_ordered = ['tickets', 'emails', 'consents', 'customers'];

                await db.executeQuery("SET FOREIGN_KEY_CHECKS = 0;");
                const tables = await db.executeQuery("SHOW TABLES ");

                for (let table of tables) {
                    const tableName = table[Object.keys(table)[0]];
                    if (tableName === 'migrations' || tableName === 'names-to-gender') {
                        continue;
                    }
                    if (tables_ordered.indexOf(tableName) < 0) {
                        tables_ordered.push(tableName);
                    }
                }

                for (let tableName of tables_ordered) {
                    await db.executeQuery(`DELETE FROM ${tableName};`);
                    await db.executeQuery(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1;`);
                }

                await db.executeQuery("SET FOREIGN_KEY_CHECKS = 1;");
                await db.executeQuery("COMMIT");
                resetSuccess = true;

            } else if (ctx.request.files && ctx.request.files.file) {

                if (ctx.request.body.content && ctx.request.body.content === 'codes') {

                    uploadSuccess = false;

                    const codeType = +(ctx.request.body.code_type) || 0

                    if (codesTypes.indexOf(codeType) < 0) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new Error('invalid codeType')
                    }

                    const workSheetsFromBuffer = xlsx.parse(fs.readFileSync(path.resolve(ctx.request.files.file.path)));

                    const rows = workSheetsFromBuffer["0"].data.slice(8).map(i => [i[0], codeType])

                    addedCodesCount = rows.length;

                    await db.executeQuery(fillCodesTable(), [rows])

                    uploadSuccess = true;

                } else {

                    const sendCustomersLetters = !!ctx.request.body.send;

                    const newCustomerIds = [];

                    const result = await db.executeQuery("SELECT * FROM `names-to-gender`", []);
                    const nameToGender = result.reduce(function (accumulator, current) {
                        accumulator[current.name] = current.gender
                        return accumulator;
                    }, {});

                    const rows = []

                    const $ = cheerio.load((fs.readFileSync(path.resolve(ctx.request.files.file.path)) + '').split('<!DOCTYPE').shift());

                    const eventName = $('body > table tr:nth-child(2) td table tr:nth-child(2) td').text().split(':').pop().trim();

                    $('body > table tr:nth-child(3) td table tr:not(:first-child)').each(function () {
                        const row = {}
                        $('td', this).each(function (i) {
                            row[i] = $(this).text().trim();
                        });
                        rows.push(row)
                    });

                    parsedRowsCount = rows.length

                    const newRows = []
                    let newCodesNeeded = 0;

                    for (let row of rows) {
                        try {
                            const orderId = row[0].trim()

                            const ticketsFilter = {order_number: true};
                            const query = getTicketsQuery(ticketsFilter, -1, 0);
                            const tickets = await db.executeQuery(query, [orderId]);

                            if (Array.isArray(tickets) && tickets.length > 0) {
                                continue;
                            }
                            const ticketsCount = +row[9].trim()
                            newCodesNeeded += ticketsCount
                            newRows.push(row)
                        } catch (e) {
                            // noinspection ExceptionCaughtLocallyJS
                            throw e;
                        }
                    }

                    if (newRows.length) {

                        const codes = {}

                        for (let type of codesTypes) {
                            codes[type] = (await db.executeQuery(getUnusedCodes(type), [])).map(i => i.code);
                            if (codes[type].length < newCodesNeeded) {
                                needMoreCodes = true;
                                uploadSuccess = false;
                                break;
                            }
                        }

                        if (!needMoreCodes) {

                            for (let row of newRows) {
                                try {
                                    const orderId = row[0].trim()
                                    const orderDate = row[1].trim()
                                    const ticketsCount = +row[9].trim()
                                    const ticketsPrice = +row[10].trim()
                                    const name = row[27].trim()
                                    const surname = row[28].trim()
                                    const gender = getGender(nameToGender, name, surname);
                                    const email = row[29].trim()

                                    const hash = crypto.createHash('md5').update(email + config.hashSecret).digest("hex");
                                    const params = [
                                        email,
                                        name,
                                        surname,
                                        null,
                                        gender,
                                        hash,
                                        name,
                                        surname,
                                        null,
                                        gender,
                                    ]

                                    const upsertResult = await db.executeQuery(insertCustomerQuery(), params);

                                    let customerId = upsertResult.insertId || 0;

                                    if (!customerId) {
                                        const result = await db.executeQuery(getCustomerByEmailQuery(), [email]);
                                        if (Array.isArray(result) && result.length) {
                                            customerId = result[0].id
                                        }
                                    }

                                    if (customerId) {
                                        const amount = +ticketsPrice;
                                        const order_number = +orderId;
                                        const date = new Date(orderDate);

                                        const params = []
                                        for (let i = 0; i < ticketsCount; i++) {
                                            const surcharge = surcharges[amount] || 0
                                            const data = [customerId, order_number, date, eventName, amount, surcharge]
                                            codesTypes.forEach( codeType => {
                                                data.push(codes[codeType].pop())
                                            })
                                            params.push(data)
                                        }

                                        await db.executeQuery(insertTicketsQuery(), [params]);
                                        addedOrdersCount++
                                        newCustomerIds.push(customerId)

                                    }
                                } catch (e) {
                                    // noinspection ExceptionCaughtLocallyJS
                                    throw e;
                                }
                            }
                            uploadSuccess = true;
                        }
                    }

                    await db.executeQuery("COMMIT");


                    if (sendCustomersLetters && newCustomerIds.length) {
                        const customers = await db.executeQuery(filterNewCustomers(), [config.emailTemplateConsentRequest, newCustomerIds]);

                        if (customers.length) {

                            const batch = [];
                            const emailToCustomerId = {};

                            for (const customer of customers) {
                                emailToCustomerId[customer.email] = customer.id;

                                const ticketsFilter = {customer: true, has_no_consent: true};

                                const query = getTicketsTotalsQuery(ticketsFilter, -1, 0);
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
                                        url: `${config.publicHost}/customer/${customer.url_hash}`,
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

                            await db.executeQuery("START TRANSACTION");

                            const query = insertEmailQuery();
                            for (const r of sendingResult) {
                                if (r.ErrorCode) {
                                    continue;
                                }
                                await db.executeQuery(query, [r.MessageID, emailToCustomerId[r.To], config.emailTemplateConsentRequest]);
                                lettersSendCount++
                            }

                            await db.executeQuery("COMMIT");

                        }
                    }
                }
            }
        } catch
            (e) {
            ctx.log.error(e);
            ctx.log.error('rolling back transaction');
            await db.executeQuery("ROLLBACK");
            ctx.throw(500)
        }


    }

    return ctx.render(template, {
        finished: false,
        allowedDelimiters: allowedDelimiters,
        allowedCharsets: allowedCharsets,
        delimetersNames: delimetersNames,
        parsedRowsCount: parsedRowsCount,
        addedOrdersCount: addedOrdersCount,
        addedCodesCount: addedCodesCount,
        lettersSendCount: lettersSendCount,
        content: ctx.request.body ? ctx.request.body.content : '',
        resetSuccess: resetSuccess,
        uploadSuccess: uploadSuccess,
        needMoreCodes: needMoreCodes,
        formAction: pagePath(ctx.state.activeMenu, null),
        codesTypes,
        codesNames,
    })

}
;
