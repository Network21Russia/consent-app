'use strict';

const config = require('../../config/config');
const {composeTickets, composeExchange, exchangeOptions} = require('../utils/compose-tickets');

module.exports = async (ctx) => {

    let template = '';
    ctx.state.title = 'Образец Соглашения';

    const type = ctx.params.type || '';
    switch (type) {
        case "code":
            template = 'consent-code'
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
        "action": type + '-1',
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
        "action": type + '-2',
        "surcharge_amount": 200,
        "code_type_1": "XXXX-XXXX-XXX2",
        "code_type_2": "YYYY-YYYY-YYY2",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ2",
        "ticket_id": 67
    }, {
        "id": 68,
        "customer_id": 29,
        "consent_id": null,
        "order_number": 2100024543,
        "order_date": "2020-02-29T21:00:00.000Z",
        "event_name": "ВЕСНА. WES Екатеринбург (осень 2021)",
        "amount": 4000,
        "action": type + '-2',
        "surcharge_amount": 500,
        "code_type_1": "XXXX-XXXX-XXX3",
        "code_type_2": "YYYY-YYYY-YYY3",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ3",
        "ticket_id": 68
    }, {
        "id": 69,
        "customer_id": 29,
        "consent_id": null,
        "order_number": 2100024543,
        "order_date": "2020-02-29T21:00:00.000Z",
        "event_name": "ВЕСНА. WES Екатеринбург (осень 2021)",
        "amount": 4000,
        "action": type + '-3',
        "surcharge_amount": 500,
        "code_type_1": "XXXX-XXXX-XXX4",
        "code_type_2": "YYYY-YYYY-YYY4",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ4",
        "ticket_id": 69
    }, {
        "id": 70,
        "customer_id": 29,
        "consent_id": null,
        "order_number": 2100024543,
        "order_date": "2020-02-29T21:00:00.000Z",
        "event_name": "ВЕСНА. WES Екатеринбург (осень 2021)",
        "amount": 4000,
        "action": type + '-3',
        "surcharge_amount": 500,
        "code_type_1": "XXXX-XXXX-XXX5",
        "code_type_2": "YYYY-YYYY-YYY5",
        "code_type_3": "ZZZZ-ZZZZ-ZZZ5",
        "ticket_id": 70
    }]

    const fakeConsent = {
        "id": 1,
        "customer_id": 17,
        "datetime": "2021-04-01T08:57:33.000Z",
        "type": type,
        "signed_email": "ileksaz-gulnaz@mail.ru",
        "signed_name": "Иван",
        "signed_surname": "Иванов",
        "signed_patronimic": "Иванович",
        "signed_pass_serial": "1234",
        "signed_pass_number": "234324",
        "code_sent": 0,
        "code_sent_at": null,
        "payment_received": 0,
        "payment_received_at": null,
        "consent_number": (type === 'code' ? '1' : '2') + "00001",
        "consent_tickets": 5,
        "consent_tickets_amount": 19400,
        "consent_tickets_surcharge_amount": 1900
    }

    return ctx.render(template, {
        isTemplate: true,
        consent: fakeConsent,
        customer: fakeCustomer,
        consentSigner: config.consentSigner,
        composedTickets: composeTickets(fakeTickets),
        composeExchange: composeExchange(fakeTickets),
        exchangeOptions: exchangeOptions[type],
    })
};
