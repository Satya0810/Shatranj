const https = require('https');

https.get('https://lichess.org/tv/frame', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});

https.get('https://lichess.org/training/frame', (res) => {
  console.log('\nPuzzle Status Code:', res.statusCode);
  console.log('Puzzle Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
