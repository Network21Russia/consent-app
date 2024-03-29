'use strict';

const config = require('../config/config')

module.exports = {
    customers: {
        path: config.adminRoutesNamespace,
        name: "Покупатели",
    },
    tickets: {
        path: config.adminRoutesNamespace + '/tickets',
        name: "Билеты",
    },
    emails: {
        path: config.adminRoutesNamespace + '/emails',
        name: "Письма",
    },
    consents: {
        path: config.adminRoutesNamespace + '/consents',
        name: "Соглашения",
    },
    send: {
        path: config.adminRoutesNamespace + '/send',
        name: "Рассылки",
    },
    data: {
        path: config.adminRoutesNamespace + '/data',
        name: "Данные",
    },
};
