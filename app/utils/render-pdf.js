'use strict';

const pdf = require('html-pdf');

async function renderPdf(html) {
    const pdfOptions = {
        format: 'A4',
        orientation: "portrait",
        border: '20mm',
        type: "pdf",
        dpi: 200,
        quality: 80,
        zoomFactor: "1",
        paginationOffset: 1,
        footer: {
            height: "15mm",
            contents: {
                default: '<div style="text-align: center">страница {{page}} из {{pages}}</div>',
            }
        },
    };
    return new Promise((resolve, reject) => {
        pdf.create(html, pdfOptions).toBuffer(async function (err, buffer) {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}

module.exports = renderPdf;
