'use strict'

function composeTickets(tickets) {
    const ticketsComposed = {}
    tickets.forEach(t => {
        ticketsComposed[t.order_number] = ticketsComposed[t.order_number] || {
            count: 0,
            sum: 0,
            id: 0,
            amount: t.amount,
            order_number: t.order_number,
            order_date: t.order_date,
            event_name: t.event_name,
        };
        ticketsComposed[t.order_number].count += 1;
        ticketsComposed[t.order_number].sum += t.amount;
    });
    return Object.values(ticketsComposed);
}

function composeExchange(tickets) {
    const ticketsComposed = {}
    tickets.forEach(t => {
        ticketsComposed[ t.action] = ticketsComposed[ t.action] || {
            action:  t.action,
            count: 0,
            amount: t.amount,
            surcharge_amount: t.surcharge_amount,
            new_amount: t.amount + t.surcharge_amount,
            sum: 0,
        };
        ticketsComposed[ t.action].count += 1;
        ticketsComposed[ t.action].sum += t.amount;
    });
    return Object.values(ticketsComposed);
}

const exchangeOptions = {
    'code': {
        'code-1': '3&nbsp;месяца подписки на&nbsp;<nobr>Лидерский-Плюс</nobr> тарифный план N21 Mobile (обычная стоимость 3&nbsp;&times;&nbsp;1&nbsp;499&nbsp;руб. = 4&nbsp;497&nbsp;руб.)',
        'code-2': '4&nbsp;месяца подписки на&nbsp;Лидерский тарифный план N21 Mobile (обычная стоимость 4&nbsp;&times;&nbsp;1&nbsp;149&nbsp;руб. = 4&nbsp;596&nbsp;руб.)',
        'code-3': '6&nbsp;месяцев подписки на&nbsp;Партнерский тарифный план N21 Mobile (обычная стоимость 6&nbsp;&times;&nbsp;689&nbsp;руб. = 4&nbsp;134&nbsp;руб.)',
    },
    'surcharge': {
        'surcharge-1': 'на семинар WES в Екатеринбурге <nobr>2&ndash;4.07.2021</nobr>',
        'surcharge-2': 'на семинар WES в Москве <nobr>16&ndash;18.07.2021</nobr>',
        'surcharge-3': 'на семинар WES в Ростове-на-Дону <nobr>23&ndash;25.07.2021</nobr>',
    }
}

module.exports = {composeTickets, composeExchange, exchangeOptions};
