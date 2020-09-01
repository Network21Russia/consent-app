'use strict';


module.exports = async (ctx, next) => {
    ctx.state.title = 'Согласие подписано!';

    const hash = ctx.params.hash || '';
    if (!hash) {
        ctx.throw(500);
    }


    let template = 'consent-signed';

    return ctx.render(template, {});


};
