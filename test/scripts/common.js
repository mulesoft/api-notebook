/* global mocha, chai */
mocha.setup('bdd');
mocha.reporter('html');

window.expect       = chai.expect;
window.NOTEBOOK_URL = process.env.application.url;
window.FIXTURES_URL = window.NOTEBOOK_URL + '/test/fixtures';
