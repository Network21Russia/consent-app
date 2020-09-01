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
        name: "Согласия",
    },
    send: {
        path: config.adminRoutesNamespace + '/send',
        name: "Запуск рассылки",
    },
    data: {
        path: config.adminRoutesNamespace + '/data',
        name: "Данные",
    },
};
