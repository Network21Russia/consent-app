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

    if (count) {
        result.push('SELECT count(*) AS count FROM (');
    }
    result.push('SELECT ');
    result.push(`
           customers.id,
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
    `);
    result.push('FROM customers');
    result.push(`LEFT JOIN emails ON emails.customer_id = customers.id ${emails_join_condition}`);
    result.push('LEFT JOIN consents ON consents.customer_id = customers.id');
    result.push(where_clause);
    result.push('GROUP BY customers.id');
    result.push(having_clause);

    if (count) {
            result.push(') t');
    } else {
        result.push('ORDER BY surname, name, patronimic, id');
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
        where_clause = 'WHERE customer_id = ?';
    } else if (filter.id) {
        where_clause = 'WHERE id = ?';
    }

    const result = ['SELECT'];

    if (count) {
        result.push('count(*) AS count');
    } else {
        result.push('*');
    }
    result.push('FROM consents');
    result.push(where_clause);

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
    return _getEmailsQuery(filter, false, limit, offset);
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
        result.push('*');
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


function insertConsentQuery() {
    return 'INSERT INTO `consents`(`customer_id`, `signed_email`, `signed_name`, `signed_surname`, `signed_patronimic`, `signed_tickets`) VALUES (?, ?, ?, ?, ?, ?)'
}

function insertEmailQuery() {
    return "INSERT INTO `emails`(`external_id`, `customer_id`, `template_id`) VALUES (UNHEX(REPLACE(?, '-', '')), ?, ?)";
}

function setEmailOpenQuery() {
    return "UPDATE `emails` SET `is_open` = 1,`open_datetime` = CURRENT_TIMESTAMP WHERE external_id = UNHEX(REPLACE(?, '-', ''))";
}

module.exports = {
    getCustomersQuery: getCustomersQuery,
    getCustomersCountQuery: getCustomersCountQuery,
    getConsentsQuery: getConsentsQuery,
    getConsentsCountQuery: getConsentsCountQuery,
    getEmailsQuery: getEmailsQuery,
    getEmailsCountQuery: getEmailsCountQuery,
    insertConsentQuery: insertConsentQuery,
    insertEmailQuery: insertEmailQuery,
    setEmailOpenQuery: setEmailOpenQuery,
}
