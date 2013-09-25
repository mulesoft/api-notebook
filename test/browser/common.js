/* global mocha, chai, global */
mocha.setup('bdd');
mocha.reporter('html');
global.expect = chai.expect;

// Alias useful params for testing.
global.NOTEBOOK_URL = process.env.NOTEBOOK_URL;
