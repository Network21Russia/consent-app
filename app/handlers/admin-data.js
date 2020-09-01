'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const iconv = require('iconv-lite');
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {insertCustomerQuery, getCustomerByEmailQuery, insertTicketQuery} = require('../db/queries')
const menu = require('../admin-menu');
const pagePath = require('../utils/page-path');

const allowedDividers = [',', ';'];
const allowedCharsets = ['win1251', 'utf8'];

module.exports = async (ctx, next) => {

    ctx.state.title = 'Данные';
    ctx.state.menu = menu;
    ctx.state.activeMenu = 'data';

    const template = 'admin-data';

    let parsedRowsCount = 0;
    let uploadSuccess = null;
    let resetSuccess = null;

    if (ctx.request.method === 'POST') {

        const db = DatabaseConnection.getInstance(config.db);

        try {

            await db.executeQuery("START TRANSACTION");

            if (ctx.request.body.reset && ctx.request.body.reset === '1') {

                resetSuccess = false;

                const tables_ordered = ['tickets', 'emails', 'consents', 'customers'];

                await db.executeQuery("SET FOREIGN_KEY_CHECKS = 0;");
                const tables = await db.executeQuery("SHOW TABLES ");

                for (let table of tables) {
                    const tableName = table[Object.keys(table)[0]];
                    if (tableName === 'migrations') {
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

                uploadSuccess = false;

                let divider = ctx.request.body.divider || allowedDividers[0];
                if (allowedDividers.indexOf(divider) < 0) {
                    divider = allowedDividers[0]
                }

                let charset = ctx.request.body.divider || allowedCharsets[0];
                if (allowedCharsets.indexOf(charset) < 0) {
                    charset = allowedCharsets[0]
                }

                const parserOptions = {
                    delimiter: divider
                }

                const upsertCustomerQuery = insertCustomerQuery();
                const getCustomerQuery = getCustomerByEmailQuery();
                const ticketQuery = insertTicketQuery();
                const rows = [];

                await new Promise((resolve, reject) => {
                    fs.createReadStream(path.resolve(ctx.request.files.file.path))
                        .pipe(iconv.decodeStream(charset))
                        .pipe(iconv.encodeStream('utf8'))
                        .pipe(csv.parse(parserOptions))
                        .on('error', e => {
                            reject(e);
                        })
                        .on('data', async (row) => {
                            rows.push(row);
                        })
                        .on('end', async (rowCount) => {
                            ctx.log.info(`Parsed ${rowCount} rows`);
                            resolve()
                        })
                });

                parsedRowsCount = rows.length

                for (let row of rows) {
                    try {
                        const params = [
                            row[7],
                            row[4],
                            row[5],
                            null,
                            row[6],
                            row[4],
                            row[5],
                            null,
                            row[6],
                        ]

                        await db.executeQuery(upsertCustomerQuery, params);

                        const result = await db.executeQuery(getCustomerQuery, [row[7]]);

                        if (Array.isArray(result) && result.length) {
                            const customer = result[0];

                            const ticketsCount = row[2] * 1;
                            const amount = row[3] * 1;
                            const order_number = row[0] * 1;
                            const date = new Date(row[1]);

                            const params = [customer.id, order_number, date, amount]

                            for (let i = 0; i < ticketsCount; i++) {
                                await db.executeQuery(ticketQuery, params);
                            }
                        }
                    } catch (e) {
                        throw e;
                    }
                }

                await db.executeQuery("COMMIT");
                uploadSuccess = true;
            }

        } catch (e) {
            ctx.log.error(e);
            ctx.log.error('rolling back transaction');
            await db.executeQuery("ROLLBACK");
            ctx.throw(500)
        }
    }

    return ctx.render(template, {
        finished: false,
        allowedDividers: allowedDividers,
        allowedCharsets: allowedCharsets,
        parsedRowsCount: parsedRowsCount,
        resetSuccess: resetSuccess,
        uploadSuccess: uploadSuccess,
        formAction: pagePath(ctx.state.activeMenu, null),
    })

};
