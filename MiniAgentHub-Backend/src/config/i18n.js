const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'vi',
    load: 'languageOnly',
    preload: ['vi', 'en'],
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}.json')
    },
    detection: {
      order: ['header', 'querystring', 'cookie'],
      caches: false
    }
  });

module.exports = {
  i18next,
  middleware
};
