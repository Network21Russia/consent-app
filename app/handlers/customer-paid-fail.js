'use strict';


module.exports = async (ctx) => {
    ctx.state.title = 'Ошибка!';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }

    const consentId = +ctx.params.consentId || 0;

    let template = 'payment-fail';

    return ctx.render(template, {hash, consentId});
};
