const flowiseStrategy = require('./flowiseStrategy');
const groqStrategy = require('./groqStrategy');

const aiStrategies = {
    "Data Analyst": flowiseStrategy,
    "default": groqStrategy
};

const getChatStrategy = (modelName) => {
    return aiStrategies[modelName] || aiStrategies["default"];
};

module.exports = {
    getChatStrategy
};
