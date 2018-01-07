module.exports = {
  application: {
    url: process.env.URL ? process.env.URL :  'http://localhost:3000',
    title:         process.env.TITLE ? process.env.TITLE : 'Notebook Site',
    oauthCallback: process.env.OAUTH_CALLBACK ? process.env.OAUTH_CALLBACK : '/authenticate/oauth.html',
    whitelist: process.env.WHITELIST ? process.env.WHITELIST : '*'
  },
  pkg: require('../package.json'),
  embed: {
    script: process.env.EMBED_SCRIPT ? process.env.EMBED_SCRIPT : 'http://localhost:3000/scripts/embed.js'
  },
  plugins: {
    proxy: {
      url: '/proxy'
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID : '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ? process.env.GITHUB_CLIENT_SECRET : ''
    }
  }
};
