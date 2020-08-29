'use strict';

function throwVariableError(variableName) {
    const message = `Environment variable '${variableName}' is not set`;
    throw new Error(message);
}

const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
if (!nodeEnv) {
    throwVariableError('NODE_ENV');
}

const isLocal = nodeEnv === 'local';
const isTest = nodeEnv === 'test';

const getEnvVariable = function (variableName, defaultValue) {
    const envVal = process.env[variableName];
    if (typeof envVal !== 'undefined') {
        return envVal;
    }
    if (!(isLocal || isTest)) {
        throwVariableError(variableName);
    }
    return defaultValue;
};


module.exports.getEnvVariable = getEnvVariable;
module.exports.isLocal = isLocal;
module.exports.isTest = isTest;
