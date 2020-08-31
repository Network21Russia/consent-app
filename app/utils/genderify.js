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

module.exports = genderify;
