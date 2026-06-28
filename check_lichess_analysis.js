const https = require('https');

https.get('https://lichess.org/analysis/frame', (res) => {
  console.log('Analysis/frame Status Code:', res.statusCode);
  console.log('Analysis/frame Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});

https.get('https://lichess.org/embed/analysis', (res) => {
  console.log('\nEmbed/analysis Status Code:', res.statusCode);
  console.log('Embed/analysis Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
