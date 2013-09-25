var express  = require('express');
var app      = module.exports = express();
var path     = require('path');

var PORT       = process.env.PORT || 8000;
var STATIC_DIR = path.join(__dirname, 'build');

app.configure(function () {
  app.use(express.logger());

  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin',  '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    return next();
  });

  app.use(express.static(STATIC_DIR));

  // Mount the raml examples under `/raml` for the notebook to use.
  var ramlExamples = path.dirname(require.resolve('raml-examples'));
  app.use('/raml', express.static(ramlExamples));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.use(require('./routes'));

app.listen(PORT, function () {
  console.log('Server listening on port ' + PORT);
});
