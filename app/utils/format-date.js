'use strict'

const months = {
    0: 'января',
    1: 'февраля',
    2: 'марта',
    3: 'апреля',
    4: 'мая',
    5: 'июня',
    6: 'июля',
    7: 'августа',
    8: 'сентября',
    9: 'октября',
    10: 'ноября',
    11: 'декабря',
}

function fixTz(date) {
    const _date = new Date(date);
    _date.setMinutes(_date.getMinutes() + (_date.getTimezoneOffset() * -1));
    return _date
}

function formatDate(date) {
    const _date = fixTz(date);
    return [_date.getDate(), months[_date.getMonth()], _date.getFullYear()].join(' ');
}

function formatDateTime(date) {
    return fixTz(date).toISOString().replace('T', ' ').split('.')[0];
}

module.exports = {formatDate, formatDateTime};
