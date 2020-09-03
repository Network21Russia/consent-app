function ready(fn) {
    if (document.readyState !== 'loading') {
        fn();
    } else if (document.addEventListener) {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        document.attachEvent('onreadystatechange', function () {
            if (document.readyState !== 'loading')
                fn();
        });
    }
}

function addEventListener(el, eventName, handler) {
    if (el.addEventListener) {
        el.addEventListener(eventName, handler);
    } else {
        el.attachEvent('on' + eventName, function () {
            handler.call(el);
        });
    }
}

function addClass(el, className) {
    if (el.classList) {
        el.classList.add(className);
    } else {
        var current = el.className, found = false;
        var all = current.split(' ');
        for (var i = 0; i < all.length, !found; i++) found = all[i] === className;
        if (!found) {
            if (current === '') el.className = className;
            else el.className += ' ' + className;
        }
    }
}

function removeClass(el, className) {
    if (el.classList)
        el.classList.remove(className);
    else
        el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
}

function hasClass(el, className) {
    return el.classList ? el.classList.contains(className) : new RegExp('(^| )' + className + '( |$)', 'gi').test(el.className);
}

function toggleClass(el, className) {
    if (el.classList) {
        el.classList.toggle(className);
    } else {
        var classes = el.className.split(' ');
        var existingIndex = -1;
        for (var i = classes.length; i--;) {
            if (classes[i] === className)
                existingIndex = i;
        }

        if (existingIndex >= 0)
            classes.splice(existingIndex, 1);
        else
            classes.push(className);

        el.className = classes.join(' ');
    }
}

function formatMoney(a, n, x, s, c) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\D' : '$') + ')',
        num = a.toFixed(Math.max(0, ~~n));

    return (c ? num.replace('.', c) : num).replace(new RegExp(re, 'g'), '$&' + (s || ','));
}

function declension(count, oneNominative, severalNominative, severalGenitive, options) {
    options = options || {};
    var params = Object.assign({}, {printCount: true, delimiter: ' '}, options);
    var result = [];
    if (params.printCount) {
        result.push(count);
    }

    if (typeof count !== 'number') {
        return '';
    }
    if (!(Number.isFinite(count) && !(count % 1))) {
        result.push(severalNominative);
        return result.join(params.delimiter);
    }
    count = Math.abs(count);
    count %= 100;
    if (count >= 5 && count <= 20) {
        result.push(severalGenitive);
        return result.join(params.delimiter);
    }
    count %= 10;
    if (count === 1) {
        result.push(oneNominative);
        return result.join(params.delimiter);
    }
    if (count >= 2 && count <= 4) {
        result.push(severalNominative);
        return result.join(params.delimiter);
    }
    result.push(severalGenitive);
    return result.join(params.delimiter);
}
