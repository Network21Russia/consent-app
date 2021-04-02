# Consent app

Приложение, для получения согласий от пользователей на смену формата мероприятий по ранее приобретенным билетам.

## System requirements

* Node.js 10+
* NPM v6+
* MySQL 5.7+

## Deploy
* `npm install`
* `npm prune --production`
* `node ./index.js`


## Environment variables

| Name | Description |
|:---|:---|
| CLEARDB_DATABASE_URL           | Mysql database DSN |
| DB_CONNECTIONS_LIMIT           | Connection limit for Mysql Pool |
| NODE_ENV                       | Current environment |
| PORT                           | Application port |
| PUBLIC_HOST                    | Public host of application, example: mysite.ru |
| OFFICIAL_SITE                  | Site of headquoters |
| ADMIN_LOGIN                    | Login for admin part |
| ADMIN_PASSWORD                 | Password for admin part |
| EMAIL_POSTMARK_TOKEN           | Token for access to Postmark API |
| EMAIL_SENDER_FROM              | Email from which letters will be sending |
| EMAIL_TEMPLATE_CONSENT_REQUEST | Template id in Postmark for letter with consent request |
| EMAIL_TEMPLATE_CONSENT_PDF     | Template id in Postmark for letter with consent confirm |
| CONSENT_SIGNER                 | Name of person signing consent from headquarters |
| EMAIL_ADMIN_EMAIL              | Email to send copies of signed consents for headquoters |
| HASH_SECRET                    | Secret to make url hash |
| SBERBANK_USERNAME              | Username in Sberbank REST API, to create payments |
| SBERBANK_PASSWORD              | Password in Sberbank REST API, to create payments |
| SBERBANK_API                   | Sberbank REST API url |

## Develoment and support

Application developed and supported by Evgenii Strigo aka james.kotoff@gmail.com, in august of 2020 - april 2021.

