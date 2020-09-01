'use strict';

const pdf = require('html-pdf');

async function renderPdf(html) {
    const pdfOptions = {
        format: 'A4',
        orientation: "portrait",
        border: '2cm',
        type: "pdf",
        dpi: 200,
        quality: 80,
        zoomFactor: "1",
    };
    return new Promise((resolve, reject) => {
        pdf.create(html, pdfOptions).toBuffer(async function (err, buffer) {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}

module.exports = renderPdf;
