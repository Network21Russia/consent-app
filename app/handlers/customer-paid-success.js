'use strict';


module.exports = async (ctx) => {
    ctx.state.title = 'Оплата прошла успешно';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }


    let template = 'payment-success';

    return ctx.render(template, {});
};
