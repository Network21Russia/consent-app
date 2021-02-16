'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const xlsx = require('node-xlsx').default;
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {
    insertCustomerQuery, getCustomerByEmailQuery, insertTicketsQuery, getTicketsIdWithoutCodes, truncateTemporaryTable,
    fillTemporaryTable, fillCodesToTickets, getTicketsQuery, getTicketsCodes
} = require('../db/queries')
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

function getGender(dict, name, surname) {

    const nameLc = name.toLowerCase();
    const surnameLc = surname.toLowerCase();

    if (dict.hasOwnProperty(nameLc)) {
        return dict.hasOwnProperty(nameLc)
    }
    // fallback на случай если в таблице перепутаны местами имя и фамилия
    if (dict.hasOwnProperty(surnameLc)) {
        return dict.hasOwnProperty(surnameLc)
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

    console.log('blah', name, surname)

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
    let uploadSuccess = null;
    let resetSuccess = null;

    if (ctx.request.method === 'POST') {

        const db = DatabaseConnection.getInstance(config.db);

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
                resetSuccess = true;

            } else if (ctx.request.files && ctx.request.files.file) {

                if (ctx.request.body.content && ctx.request.body.content === 'codes') {
                    uploadSuccess = false;

                    const workSheetsFromBuffer = xlsx.parse(fs.readFileSync(path.resolve(ctx.request.files.file.path)));

                    const rows = workSheetsFromBuffer["0"].data.slice(6).map(i => i[0])

                    parsedRowsCount = rows.length

                    const idsWithConsents = await db.executeQuery(getTicketsIdWithoutCodes(true));
                    const idsWithoutConsents = await db.executeQuery(getTicketsIdWithoutCodes(false));
                    const usedCodes = (await db.executeQuery(getTicketsCodes())).map(uc => uc.code);

                    const ids = [].concat(idsWithConsents, idsWithoutConsents)

                    const values = [];
                    const totalIds = ids.length
                    if (totalIds) {
                        let cnt = 0;
                        for (let i = 0; i < rows.length; i++) {
                            if (usedCodes.indexOf(rows[i]) >= 0) {
                                continue
                            }

                            values.push([ids[cnt].id, rows[i]]);
                            cnt++;
                            if (cnt >= totalIds) {
                                break
                            }
                        }

                        addedCodesCount = values.length
                        if (addedCodesCount) {
                            await db.executeQuery(truncateTemporaryTable());
                            await db.executeQuery(fillTemporaryTable(), [values]);
                            await db.executeQuery(fillCodesToTickets());
                            await db.executeQuery(truncateTemporaryTable());
                            uploadSuccess = true;
                        } else {
                            uploadSuccess = false;
                        }
                    } else {
                        uploadSuccess = true;
                    }
                } else {

                    const result = await db.executeQuery("SELECT * FROM `names-to-gender`", []);
                    const nameToGender = result.reduce(function (accumulator, current) {
                        accumulator[current.name] = current.gender
                        return accumulator;
                    }, {});

                    const rows = []

                    const $ = cheerio.load((fs.readFileSync(path.resolve(ctx.request.files.file.path)) + '').split('<!DOCTYPE').shift());

                    $('body > table tr:nth-child(3) td table tr:not(:first-child)').each(function () {
                        const row = {}
                        $('td', this).each(function (i) {
                            row[i] = $(this).text().trim();
                        });
                        rows.push(row)
                    });

                    parsedRowsCount = rows.length

                    await db.executeQuery("START TRANSACTION");

                    for (let row of rows) {
                        try {
                            const orderId = row[0].trim()

                            const ticketsFilter = {order_number: true};
                            const query = getTicketsQuery(ticketsFilter, -1, 0);
                            const tickets = await db.executeQuery(query, [orderId]);

                            if (Array.isArray(tickets) && tickets.length > 0) {
                                continue;
                            }

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

                                const ticketParams = [customerId, order_number, date, amount]
                                const params = []

                                for (let i = 0; i < ticketsCount; i++) {
                                    params.push(ticketParams)
                                }

                                await db.executeQuery(insertTicketsQuery(), [params]);
                                addedOrdersCount++
                            }
                        } catch (e) {
                            // noinspection ExceptionCaughtLocallyJS
                            throw e;
                        }
                    }
                    uploadSuccess = true;
                }
            }
        } catch
            (e) {
            ctx.log.error(e);
            ctx.log.error('rolling back transaction');
            await db.executeQuery("ROLLBACK");
            ctx.throw(500)
        }

        if (uploadSuccess || resetSuccess) {
            await db.executeQuery("COMMIT");
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
        content: ctx.request.body ? ctx.request.body.content : '',
        resetSuccess: resetSuccess,
        uploadSuccess: uploadSuccess,
        formAction: pagePath(ctx.state.activeMenu, null),
    })

}
;
