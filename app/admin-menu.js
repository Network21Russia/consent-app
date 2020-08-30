'use strict';

const config = require('../config/config')

module.exports = {
    customers: {
        path: config.adminRoutesNamespace,
        name: "Покупатели",
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
        name: "Запуск рассылки",
    },
};
