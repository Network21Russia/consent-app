'use strict'

function composeTickets(tickets) {
    const ticketsComposed = {}
    tickets.forEach(t => {
        ticketsComposed[t.order_number] = ticketsComposed[t.order_number] || {
            count: 0,
            amount: 0,
            id: 0,
            order_number: t.order_number,
            order_date: t.order_date,
        };
        ticketsComposed[t.order_number].count += 1;
        ticketsComposed[t.order_number].amount += t.amount;
    });
    return Object.values(ticketsComposed);
}

module.exports = composeTickets;
