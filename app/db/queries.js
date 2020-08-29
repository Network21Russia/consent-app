'use strict';

function getCustomersQuery(filter = {}, limit = 10, offset = 0) {
    filter = filter || {};
    limit = limit || 10;
    offset = offset || 0;

    let where_clause = '';
    let having_conditions = [];
    let having_clause = '';
    let emails_join_condition = '';

    if (filter.hash) {
        where_clause = 'WHERE hash = UNHEX(?)'
    }

    if (filter.email_template) {
        emails_join_condition = 'AND emails.template_id = ? ';
    }

    if (filter.with_rest) {
        having_conditions.push('rest_tickets > 0')
    } else if (filter.without_rest) {
        having_conditions.push('rest_tickets <= 0')
    }
    if (filter.letter_send) {
        having_conditions.push('letter_send = 1')
    } else if (filter.letter_not_send) {
        having_conditions.push('letter_send = 0')
    }
    if (filter.letter_opened) {
        having_conditions.push('letter_opened = 1')
    } else if (filter.letter_not_opened) {
        having_conditions.push('letter_opened = 0')
    }

    if (having_conditions.length) {
        having_clause = 'HAVING ' + having_conditions.join(' AND ');
    }

    return `SELECT customers.id,
               customers.surname,
               customers.name,
               customers.patronimic,
               customers.email,
               customers.tickets,
               HEX(hash)                                                   as url_hash,
               NOT ISNULL(emails.id)                                       AS letter_send,
               IF(SUM(IFNULL(emails.is_open, 0)) > 0, 1, 0)                AS letter_opened,
               NOT ISNULL(consents.id)                                     AS has_consents,
               customers.tickets - SUM(IFNULL(consents.signed_tickets, 0)) AS rest_tickets
        FROM customers
                 LEFT JOIN emails ON emails.customer_id = customers.id ${emails_join_condition}
                 LEFT JOIN consents ON consents.customer_id = customers.id
        ${where_clause}
        GROUP BY customers.id
        ${having_clause}
        ORDER BY surname, name, patronimic, id
        LIMIT ${limit} OFFSET ${offset}`;
}

function insertConsentQuery() {
    return 'INSERT INTO `consents`(`customer_id`, `signed_email`, `signed_name`, `signed_surname`, `signed_patronimic`, `signed_tickets`) VALUES (?, ?, ?, ?, ?, ?)'
}

module.exports = {
    getCustomersQuery: getCustomersQuery,
    insertConsentQuery: insertConsentQuery,
}
