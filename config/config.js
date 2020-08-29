'use strict';

const DSNParser = require('dsn-parser');

const envUtils = require('../app/utils/env');
const getEnvVariable = envUtils.getEnvVariable;

const mysqlDsn = new DSNParser(getEnvVariable('CLEARDB_DATABASE_URL', ''));
const mysqlDsnParts = mysqlDsn.getParts();

const config = {
    serverPort: +getEnvVariable('PORT', 3000),

    db: {
        name: "main",
        connectionLimit: 10,
        user: mysqlDsnParts.user,
        password: mysqlDsnParts.password,
        database: mysqlDsnParts.database,
        host: mysqlDsnParts.host,
        port: +(mysqlDsnParts.port || 3306),
        multipleStatements: true,
    },

    dbMigrationsDir: './migrations',

    publicHost: getEnvVariable('PUBLIC_HOST', ''),
    officialSite: getEnvVariable('OFFICIAL_SITE', ''),

    adminRoutesNamespace: '/admin',
    adminLogin: getEnvVariable('ADMIN_LOGIN', ''),
    adminPassword: getEnvVariable('ADMIN_PASSWORD', ''),

    emailpostmarkToken: getEnvVariable('EMAIL_POSTMARK_TOKEN', ''),
    emailSenderFrom: getEnvVariable('EMAIL_SENDER_FROM', ''),
    emailAdminEmail: getEnvVariable('EMAIL_ADMIN_EMAIL', ''),
    emailTemplateConsentRequest: +getEnvVariable('EMAIL_TEMPLATE_CONSENT_REQUEST', ''),
    emailTemplateConsentPdf: +getEnvVariable('EMAIL_TEMPLATE_CONSENT_PDF', ''),

    consentSigner: getEnvVariable('CONSENT_SIGNER', ''),

};

module.exports = config;
