'use strict';

const DatabaseConnection = require('mysql-flexi-promise');

const config = require('../../config/config');
const {getCustomersQuery, getTicketsQuery, getTicketsTotalsQuery} = require('../db/queries')

module.exports = async (ctx) => {

    let template = '';
    ctx.state.title = 'Образец Соглашения';

    const type = ctx.params.type || '';
    switch (type) {
        case "codes":
            template = 'consent-codes'
            ctx.state.title = 'Образец Соглашения о переуступке прав и обязанностей';
            break

        case "surcharge":
            template = 'consent-surcharge'
            ctx.state.title = 'Образец Соглашения о замене сроков проведения WES семинаров системы';
            break

        default:
            return ctx.throw(500);
    }

    const fakeCustomer = {
        "id": 0,
        "surname": "Иванов",
        "name": "Иван",
        "patronimic": "Иванович",
        "gender": "male",
        "email": "ivan@test.ru",
        "pass_serial": "1234",
        "pass_number": "123456",
        "url_hash": "9B5EBFAF632AEBB3F902B06E017D7AF2",
        "letter_send": 0,
        "letter_delivered": 0,
        "letter_opened": 0,
        "has_consents": 0,
        "total_tickets": 2,
        "total_tickets_amount": 7400,
        "consent_tickets": 0,
        "consent_tickets_amount": 0,
        "rest_tickets": 2,
        "rest_tickets_amount": 7400
    }

    const fakeTickets = [{
        "id": 66,
        "customer_id": 29,
        "consent_id": null,
        "order_number": 2100024435,
        "order_date": "2020-02-29T21:00:00.000Z",
        "event_name": "ОСЕНЬ. WES Екатеринбург (осень 2020)",
        "amount": 3700,
        "action": null,
        "surcharge_amount": 200,
        "code_type_1": "XXXX-XXXX-XXX1",
        "code_type_2": "YYYY-YYYY-YYY1",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ1",
        "ticket_id": 66
    }, {
        "id": 67,
        "customer_id": 29,
        "consent_id": null,
        "order_number": 2100024435,
        "order_date": "2020-02-29T21:00:00.000Z",
        "event_name": "ОСЕНЬ. WES Екатеринбург (осень 2020)",
        "amount": 3700,
        "action": null,
        "surcharge_amount": 200,
        "code_type_1": "XXXX-XXXX-XXX2",
        "code_type_2": "YYYY-YYYY-YYY2",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ3",
        "ticket_id": 67
    }]

    const fakeTicketsTotals = {"count":2,"sum":7400}

    return ctx.render(template, {
        isTemplate: true,
        customer: fakeCustomer,
        date: new Date(),
        consentSigner: config.consentSigner,
        tickets: fakeTickets,
        hasManyTickets: fakeTickets.length > 1,
        ticketsTotals: fakeTicketsTotals,
    })
};
