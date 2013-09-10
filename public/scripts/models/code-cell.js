var Cell = require('./cell');

var CodeCell = module.exports = Cell.extend({
  defaults: {
    type: 'code',
    value: ''
  }
});
