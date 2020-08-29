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

function formatDate(date) {
    return [date.getDate(), months[date.getMonth()], date.getFullYear(), 'г.'].join(' ');
}

module.exports = formatDate;
