'use strict';

const path = require('path');
const pdf = require('html-pdf');
const postmark = require("postmark");
const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, insertConsentQuery, insertEmailQuery} = require('../db/queries')

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

    let template = 'consent-signed';
    if (customer.rest_tickets <= 0) {
        template = 'no-consent';

        return ctx.render(template, {
            customer: customer
        });

    } else {
        if (tickets_count < customer.rest_tickets) {
            customer.rest_tickets = tickets_count
        }
    }

    query = insertConsentQuery();
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

    const fname = `consent-${insertResult.insertId}.pdf`;
    const output = path.join(__dirname, '../../pdf/', fname)

    const buffer = await renderPdf(rendered, pdfOptions);

    const sendingOptions = {
        TemplateId: config.emailTemplateConsentPdf,
        From: config.emailSenderFrom,
        To: customer.email,
        TemplateModel: {
            name: ([customer.name, customer.patronimic].filter(Boolean).join(' ')).trim(),
        },
        Attachments: [
            {
                "Name": fname,
                "Content": buffer.toString('base64'),
                "ContentType": "application/pdf"
            }
        ],
    };

    const sendingControlOptions = JSON.parse(JSON.stringify(sendingOptions));
    sendingControlOptions.To = config.emailAdminEmail;
    sendingControlOptions.TemplateModel.isAdminCopy = true;

    const client = new postmark.ServerClient(config.emailpostmarkToken);
    const sendingResult = await client.sendEmailBatchWithTemplates([sendingOptions, sendingControlOptions]);

    for (const r of sendingResult) {
        if (r.ErrorCode) {
            return;
        }
        const query = insertEmailQuery();
        const insertResult = await db.executeQuery(query,[r.MessageID, customer.id, config.emailTemplateConsentPdf]);
    }

    return ctx.render(template, {
        customer: customer
    });

};

async function renderPdf(html, options) {
    return new Promise((resolve, reject) => {
        pdf.create(html, options).toBuffer(async function (err, buffer) {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}