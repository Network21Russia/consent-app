'use strict';

const DatabaseConnection = require('mysql-flexi-promise');
const config = require('../../config/config');
const {setEmailOpenQuery} = require('../db/queries');

module.exports = async (ctx, next) => {

    const messageId = ctx.request.body.MessageID || '';

    if (!messageId) {
        ctx.status = 400;
        ctx.body = '';
        return;
    }

    let query = setEmailOpenQuery();

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, [messageId]);

    console.log(result);

    ctx.status = 201;
    ctx.body = '';

};
