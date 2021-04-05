'use strict'

const SberbankAcquiring = require("sberbank-acq-no-module").default;

const {exchangeOptionsReceipt} = require("./compose-tickets");

function getCartItem(name, amount, code, pos) {
    return {
        "quantity": {
            "measure": "шт",
            "value": 1
        },
        "itemAttributes": {
            "attributes": [
                {
                    "name": "paymentMethod",
                    "value": 4
                },
                {
                    "name": "paymentObject",
                    "value": "1"
                }
            ]
        },
        "tax": {
            "taxType": 0
        },
        "itemPrice": amount * 100,
        "name": name,
        "itemAmount": amount * 100,
        "positionId": pos + '',
        "itemCode": code
    }
}

async function createSberPayment(config, customer, consent, tickets, retryCounter) {
    retryCounter = retryCounter || 0

    const sberbankAcquiring = new SberbankAcquiring({
        credentials: {
            username: config.sberbank.username,
            password: config.sberbank.password,
        },
        restConfig: {
            apiUri: config.sberbank.apiUri,
        },
    });

    const re = /\((.*)\)/

    const headingCartItem = getCartItem(`Соглашение № ${consent.consent_number}`, 0, consent.consent_number, 1)

    const cartItems = [headingCartItem].concat(tickets.reduce((accumulator, current, idx) => {
        const name = exchangeOptionsReceipt['surcharge'][current.action].replace('#', current.order_number)
        accumulator.push(getCartItem(name, current.surcharge_amount, name.match(re)[1], idx + 2))
        return accumulator
    }, []))

    const orderBundle = {
        "customerDetails": {"email": customer.email},
        "cartItems": {
            "items": cartItems,
        }
    }

    const registerOptions = {
        amount: consent.consent_tickets_surcharge_amount * 100,
        currency: '643',
        language: 'ru',
        orderNumber: `C-${consent.consent_number}` + (retryCounter ? `-${retryCounter}` : ''),
        returnUrl: `${config.publicHost}/customer/${customer.url_hash}/paid`,
        failUrl: `${config.publicHost}/customer/${customer.url_hash}/${consent.id}/paid-fail`,
        description: `Доплата по Соглашению №${consent.consent_number}`,
        taxSystem: 1,
        orderBundle: JSON.stringify(orderBundle),
    }

    return sberbankAcquiring.register(registerOptions);
}

module.exports = createSberPayment
