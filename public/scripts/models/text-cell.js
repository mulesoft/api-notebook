var Cell = require('./cell');

var TextCell = module.exports = Cell.extend({
  defaults: {
    type: 'text',
    value: ''
  }
});
