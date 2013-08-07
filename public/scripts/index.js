require('./bootstrap');

// Require the application view which runs everything
(window.app = new (require('./views/app'))()).render().appendTo(document.body);
