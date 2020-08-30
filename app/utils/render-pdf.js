'use strict';

const pdf = require('html-pdf');

async function renderPdf(html) {
    const pdfOptions = {
        format: 'A4',
        orientation: "portrait",
        border: '2cm',
    };
    return new Promise((resolve, reject) => {
        pdf.create(html, pdfOptions).toBuffer(async function (err, buffer) {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}

module.exports = renderPdf;
