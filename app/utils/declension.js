'use strict'

// @example declension(1, "файл", "файла", "файлов") // 1 файл
// @example declension(2, "файл", "файла", "файлов") // 2файла
// @example declension(5, "файл", "файла", "файлов") // 5 файлов
// @example declension(-1.5, "файл", "файла", "файлов") // 1,5 файла
function declension(count, oneNominative, severalNominative, severalGenitive, options = {}) {
    options = options || {};
    const params = Object.assign({}, {printCount: true, divider: '&nbsp;'}, options);
    const result = [];
    if (params.printCount) {
        result.push(count);
    }

    if (typeof count !== 'number') {
        return '';
    }
    if (!(Number.isFinite(count) && !(count % 1))) {
        result.push(severalNominative);
        return result.join(params.divider);
    }
    count = Math.abs(count);
    count %= 100;
    if (count >= 5 && count <= 20) {
        result.push(severalGenitive);
        return result.join(params.divider);
    }
    count %= 10;
    if (count === 1) {
        result.push(oneNominative);
        return result.join(params.divider);
    }
    if (count >= 2 && count <= 4) {
        result.push(severalNominative);
        return result.join(params.divider);
    }
    result.push(severalGenitive);
    return result.join(params.divider);
}

module.exports = declension;
