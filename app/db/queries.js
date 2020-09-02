'use strict';

function getCustomersQuery(filter = {}, limit = 10, offset = 0) {
    return _getCustomersQuery(filter, false, limit, offset);
}

function getCustomersCountQuery(filter = {}) {
    return _getCustomersQuery(filter, true);
}

function _getCustomersQuery(filter = {}, count = false, limit = 10, offset = 0) {
    filter = filter || {};
    count = !!count;
    limit = limit || 10;
    offset = offset || 0;

    let where_conditions = [];
    let where_clause = '';
    let having_conditions = [];
    let having_clause = '';
    let emails_join_condition = '';

    if (filter.hash) {
        where_conditions.push('hash = UNHEX(?)')
    }
    if (filter.with_search) {
        where_conditions.push("(customers.surname LIKE ? OR customers.name LIKE ? OR customers.patronimic LIKE ? OR customers.email LIKE ?)")
    }

    if (where_conditions.length) {
        where_clause = 'WHERE ' + where_conditions.join(' AND ');
    }

    if (filter.email_template) {
        emails_join_condition = 'AND emails.template_id = ? ';
    }

    if (filter.with_consent) {
        having_conditions.push('has_consents = 1')
    } else if (filter.without_consent) {
        having_conditions.push('has_consents = 0')
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

    const result = [];

    result.push('SELECT');

    if (count) {
        result.push('count(*) AS count, total_tickets - consent_tickets AS rest_tickets');
    } else {
        result.push(`
            *,
            total_tickets - consent_tickets               AS rest_tickets,
            total_tickets_amount - consent_tickets_amount AS rest_tickets_amount
        `);
    }
    result.push(`
        FROM (
                 SELECT c.id,
                        surname,
                        name,
                        patronimic,
                        gender,
                        email,
                        url_hash,
                        letter_send,
                        letter_opened,
                        has_consents,
                        COUNT(tickets.id)                                      AS total_tickets,
                        SUM(tickets.amount)                                    AS total_tickets_amount,
                        SUM(NOT ISNULL(tickets.consent_id))                    AS consent_tickets,
                        SUM(IF(ISNULL(tickets.consent_id), 0, tickets.amount)) AS consent_tickets_amount
                 FROM (SELECT customers.id,
                              customers.surname,
                              customers.name,
                              customers.patronimic,
                              customers.gender,
                              customers.email,
                              HEX(hash)                                    as url_hash,
                              NOT ISNULL(emails.id)                        AS letter_send,
                              IF(SUM(IFNULL(emails.is_open, 0)) > 0, 1, 0) AS letter_opened,
                              NOT ISNULL(consents.id)                      AS has_consents
                       FROM customers
                                LEFT JOIN emails ON emails.customer_id = customers.id ${emails_join_condition}
                                LEFT JOIN consents ON consents.customer_id = customers.id
                       ${where_clause}
                       GROUP BY customers.id
                       ${having_clause}
                 ) c
                 LEFT JOIN tickets ON tickets.customer_id = c.id
                 GROUP BY c.id
             ) t
    `);
    if (filter.with_rest) {
        result.push('HAVING rest_tickets > 0')
    } else if (filter.without_rest) {
        result.push('HAVING rest_tickets <= 0')
    }

    if (!count) {
        result.push('ORDER BY surname, name, patronimic, t.id');
        result.push(`LIMIT ${limit} OFFSET ${offset}`);
    }

    return result.join(' ');
}

function getConsentsQuery(filter = {}, limit = 10, offset = 0) {
    return _getConsentsQuery(filter, false, limit, offset);
}

function getConsentsCountQuery(filter = {}, limit = 10, offset = 0) {
    return _getConsentsQuery(filter, false, limit, offset);
}

function _getConsentsQuery(filter = {}, count = false, limit = 10, offset = 0) {
    filter = filter || {};
    count = !!count;
    limit = limit || 10;
    offset = offset || 0;

    let where_clause = '';

    if (filter.customer_id) {
        where_clause = 'WHERE consents.customer_id = ?';
    } else if (filter.id) {
        where_clause = 'WHERE consents.id = ?';
    }

    const result = [];

    result.push('SELECT')
    if (count) {
        result.push('count(*) AS count');
    } else {
        result.push('*');
    }
    result.push('FROM (')
    result.push('SELECT');
    result.push(`
                consents.*,
                SUM(1)                                                 AS consent_tickets,
                SUM(IF(ISNULL(tickets.consent_id), 0, tickets.amount)) AS consent_tickets_amount
    `);
    result.push('FROM consents');
    result.push(`LEFT JOIN tickets ON tickets.consent_id = consents.id`);
    result.push(where_clause);
    result.push('GROUP BY consents.id');
    result.push(') t');

    if (!count) {
        result.push('ORDER BY signed_surname, signed_name, signed_patronimic, id');
        result.push(`LIMIT ${limit} OFFSET ${offset}`);
    }

    return result.join(' ');
}

function getEmailsQuery(filter = {}, limit = 10, offset = 0) {
    return _getEmailsQuery(filter, false, limit, offset);
}

function getEmailsCountQuery(filter = {}, limit = 10, offset = 0) {
    return _getEmailsQuery(filter, true, limit, offset);
}

function _getEmailsQuery(filter = {}, count = false, limit = 10, offset = 0) {
    filter = filter || {};
    count = !!count;
    limit = limit || 10;
    offset = offset || 0;

    let where_clause = '';
    const where_conditions = [];

    if (filter.id) {
        where_conditions.push('emails.customer_id = ?');
    }
    if (filter.template) {
        where_conditions.push('template_id = ?');
    }
    if (filter.isOpen) {
        where_conditions.push('is_open = ?');
    }

    if (where_conditions.length) {
        where_clause = 'WHERE ' + where_conditions.join(' AND ');
    }

    const result = ['SELECT'];

    if (count) {
        result.push('count(*) AS count');
    } else {
        result.push('*, HEX(external_id) as ext_id, emails.id as email_id');
    }
    result.push('FROM emails');
    result.push('LEFT JOIN customers c on c.id = emails.customer_id');
    result.push(where_clause);

    if (!count) {
        result.push('ORDER BY surname, name, patronimic, emails.id');
        result.push(`LIMIT ${limit} OFFSET ${offset}`);
    }

    return result.join(' ');
}

function getTicketsQuery(filter = {}, limit = 10, offset = 0) {
    return _getTicketsQuery(filter, false, limit, offset);
}

function getTicketsTotalsQuery(filter = {}) {
    return _getTicketsQuery(filter, true);
}

function _getTicketsQuery(filter = {}, count = false, limit = 10, offset = 0) {
    filter = filter || {};
    count = !!count;
    limit = limit || 10;
    offset = offset || 0;

    let where_conditions = [];
    let where_clause = '';

    if (filter.customer) {
        where_conditions.push('customer_id = ?');
    }

    if (filter.has_consent) {
        where_conditions.push("NOT ISNULL(consent_id)");
    } else if (filter.has_no_consent) {
        where_conditions.push("ISNULL(consent_id)");
    }

    if (filter.id) {
        where_conditions.push("tickets.id IN (?)");
    }

    if (filter.consent) {
        where_conditions.push("tickets.consent_id = ?");
    }

    if (filter.with_search) {
        where_conditions.push("tickets.order_number LIKE ?");
    }

    if (where_conditions.length) {
        where_clause = 'WHERE ' + where_conditions.join(' AND ');
    }

    const result = [];

    result.push('SELECT')
    if (count) {
        result.push('count(*) AS count, sum(amount) AS sum');
    } else {
        result.push('*, tickets.id AS ticket_id');
        if (filter.with_customers) {
            result.push(', HEX(c.hash) as url_hash')
        }
    }
    result.push('FROM tickets')

    if (filter.with_customers) {
        result.push('LEFT JOIN customers c on tickets.customer_id = c.id')
    }

    result.push(where_clause);

    if (!count) {
        result.push('ORDER BY');
        if (filter.with_customers) {
            result.push('surname, name, patronimic, c.id,')
        }
        result.push('order_date, order_number, consent_id');
        if (limit > -1) {
            result.push(`LIMIT ${limit} OFFSET ${offset}`);
        }
    }

    return result.join(' ');
}

function getCustomerByIdQuery() {
    return 'SELECT * FROM customers WHERE id = ?';
}

function getCustomerByEmailQuery() {
    return 'SELECT * FROM customers WHERE email = ?';
}

function insertCustomerQuery() {
    return 'INSERT INTO `customers`(`email`, `name`, `surname`, `patronimic`, `gender`, `hash`) VALUES (?, ?, ?, ?, ?, UNHEX(?))' +
        ' ON DUPLICATE KEY UPDATE `name` = ?, `surname` = ?, `patronimic` = ?, `gender` = ?;'
}

function insertTicketsQuery() {
    return 'INSERT INTO `tickets`(`customer_id`, `order_number`, `order_date`, `amount`) VALUES ?';
}

function insertConsentQuery() {
    return 'INSERT INTO `consents`(`customer_id`, `signed_email`, `signed_name`, `signed_surname`, `signed_patronimic`) VALUES (?, ?, ?, ?, ?)'
}

function insertEmailQuery() {
    return "INSERT INTO `emails`(`external_id`, `customer_id`, `template_id`) VALUES (UNHEX(REPLACE(?, '-', '')), ?, ?)";
}

function setEmailOpenQuery() {
    return "UPDATE `emails` SET `is_open` = 1,`open_datetime` = CURRENT_TIMESTAMP WHERE external_id = UNHEX(REPLACE(?, '-', ''))";
}

function setTicketsConsentQuery() {
    return "UPDATE `tickets` SET `consent_id` = ? WHERE id IN (?)";
}

module.exports = {
    getCustomerByIdQuery: getCustomerByIdQuery,
    getCustomerByEmailQuery: getCustomerByEmailQuery,
    getCustomersQuery: getCustomersQuery,
    getCustomersCountQuery: getCustomersCountQuery,
    getConsentsQuery: getConsentsQuery,
    getConsentsCountQuery: getConsentsCountQuery,
    getEmailsQuery: getEmailsQuery,
    getEmailsCountQuery: getEmailsCountQuery,
    getTicketsQuery: getTicketsQuery,
    getTicketsTotalsQuery: getTicketsTotalsQuery,
    insertCustomerQuery: insertCustomerQuery,
    insertTicketsQuery: insertTicketsQuery,
    insertConsentQuery: insertConsentQuery,
    insertEmailQuery: insertEmailQuery,
    setEmailOpenQuery: setEmailOpenQuery,
    setTicketsConsentQuery: setTicketsConsentQuery,
}
