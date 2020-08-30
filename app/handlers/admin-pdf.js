'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const renderPdf = require('../utils/render-pdf');
const {getConsentsQuery} = require('../db/queries');

module.exports = async (ctx, next) => {

    const consentId = (ctx.params.id || 0) * 1
    const offset = (ctx.query.offset || 0) * 1;

    const params = [];
    const filter = {};
    if (consentId) {
        filter.id = true;
        params.push(consentId)
    }

    let query = getConsentsQuery(filter, config.itemsOnPage, offset * config.itemsOnPage);

    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, params);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(500);
    }

    const consent = result[0];

    const customer = {
        surname: consent.signed_surname,
        name: consent.signed_name,
        patronimic: consent.signed_patronimic,
        email: consent.signed_email,
        rest_tickets: consent.signed_tickets,
    }

    const rendered = await ctx.render('consent', {
        customer: customer,
        date: consent.datetime,
        consentSigner: config.consentSigner,
        isSignMode: true,
        layout: 'pdf',
        writeResp: false,
    })

    const buffer = await renderPdf(rendered);

    const fname = `consent-${consentId}.pdf`;

    ctx.body = buffer;
    ctx.attachment(fname);

};
