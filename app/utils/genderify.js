'use strict'

const GENDER_MALE = 'male';
const GENDER_FEMALE = 'female'

function genderify(gender, male, female) {
    switch (gender) {
        case GENDER_MALE:
            return male || '';
        case GENDER_FEMALE:
            return female || '';
        default:
            return '';
    }
}

function isMale(gender) {
    return gender === GENDER_MALE;
}

function isFemale(gender) {
    return gender === GENDER_FEMALE;
}

module.exports = {
    genderify,
    isMale,
    isFemale
};
