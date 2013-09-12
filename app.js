var express  = require('express');
var app      = module.exports = express();
var path     = require('path');

var PORT       = process.env.PORT || 8000;
var STATIC_DIR = path.join(__dirname, 'build');

app.configure(function () {
  app.use(express.logger());

  app.use(express.static(STATIC_DIR));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.use(require('./routes'));

app.listen(PORT, function () {
  console.log('Server listening on port ' + PORT);
});
