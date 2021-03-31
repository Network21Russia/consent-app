'use strict'


function pluralize(isPlural, pluralValue, singularValue) {
    return isPlural ? pluralValue : singularValue
}

module.exports = {
    pluralize,
};
