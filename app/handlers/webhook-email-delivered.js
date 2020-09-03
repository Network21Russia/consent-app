'use strict';

const DatabaseConnection = require('mysql-flexi-promise');
const config = require('../../config/config');
const {setEmailDeliveredQuery} = require('../db/queries');

module.exports = async (ctx, next) => {

    const messageId = ctx.request.body.MessageID || '';

    if (!messageId) {
        ctx.status = 400;
        ctx.body = '';
        return;
    }

    let query = setEmailDeliveredQuery();

    const db = DatabaseConnection.getInstance(config.db);
    await db.executeQuery(query, [messageId]);

    ctx.status = 201;
    ctx.body = '';

};
