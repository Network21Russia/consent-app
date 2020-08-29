'use strict';

const path = require('path');
const pdf = require('html-pdf');
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, insertConsentQuery} = require('../db/queries')

module.exports = async (ctx, next) => {
    ctx.state.title = 'Соглашение';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const tickets_count = (ctx.request.body.tickets_count || 0) * 1;

    let query = getCustomersQuery({hash: hash});
    const db = DatabaseConnection.getInstance(config.db);
    const result = await db.executeQuery(query, [hash]);

    if (!(Array.isArray(result) && result.length)) {
        ctx.throw(500);
    }

    const customer = result[0];

    let template = 'consent_signed';
    if (customer.rest_tickets <= 0) {
        template = 'no_consent';

        return ctx.render(template, {
            customer: customer
        });

    } else {
        if (tickets_count < customer.rest_tickets) {
            customer.rest_tickets = tickets_count
        }
    }

    query = insertConsentQuery({hash: hash});
    const insertResult = await db.executeQuery(query,
        [customer.id, customer.email, customer.name, customer.surname, customer.patronimic, customer.rest_tickets]);

    const rendered = await ctx.render('consent', {
        customer: customer,
        consentSigner: config.consentSigner,
        isSignMode: true,
        layout: 'pdf',
        writeResp: false,
    })

    const pdfOptions = {
        format: 'A4',
        orientation: "portrait",
        border: '2cm',
    };

    const output = path.join(__dirname, `../../pdf/consent-${insertResult.insertId}.pdf`)

    pdf.create(rendered, pdfOptions).toFile(output, function (err, res) {
        if (err) return console.log(err);
        // todo: send email
    });

    return ctx.render(template, {
        customer: customer
    });

};
