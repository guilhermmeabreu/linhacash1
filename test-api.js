const https = require('https');
const options = {
  hostname: 'v2.nba.api-sports.io',
  path: '/games?date=2026-03-28',
  headers: { 'x-apisports-key': '092628837e33ff82ecd37dea652eb8d3' }
};
https.get(options, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const j = JSON.parse(data);
    console.log('Total jogos:', j.results);
    j.response?.slice(0,3).forEach(g => {
      console.log(g.teams.home.name, 'vs', g.teams.visitors.name, '|', g.date.start);
    });
  });
});
