const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'dist');
const matchdayStyles='matchday-cobalt.css';
const matchdayPreviewStyles='matchday-preview-redesign.css';
const files=['player-traits.js','player-profiles.js','player-profiles.css','homepage-polish.css','squad-redesign.css','matchday-polish.css','press-conference.css','results-cinematic.css','league-table-cinematic.css','press-conference-data.js','press-conference-engine.js','index.html','app.js','clubs.js','names.js','world-expansion.js','styles.css','aaa-career-pass.css','themes.css','central.css','central-news.css','central-news.js','training.js','training-ui.js','training.css','save-codec.js','career-storage.js','career-bootstrap.js','career-expansion.js','career-expansion.css','velmora-quidditch-engine.js','velmora-quidditch-engine.css'];
files.push('academy-redesign.css');
files.push('squad-companion-theme.css');
for(const file of files){if(!fs.existsSync(path.join(root,file)))throw new Error('Missing runtime file: '+file);if(file.endsWith('.js'))cp.execFileSync(process.execPath,['--check',path.join(root,file)]);}
if(!fs.existsSync(path.join(root,matchdayStyles)))throw new Error('Missing runtime file: '+matchdayStyles);
fs.mkdirSync(output,{recursive:true});for(const file of files)fs.copyFileSync(path.join(root,file),path.join(output,file));
fs.copyFileSync(path.join(root,matchdayStyles),path.join(output,matchdayStyles));
fs.copyFileSync(path.join(root,matchdayPreviewStyles),path.join(output,matchdayPreviewStyles));
for(const dir of ['data','vendor','badge_pack','assets'])if(fs.existsSync(path.join(root,dir)))fs.cpSync(path.join(root,dir),path.join(output,dir),{recursive:true});
console.log('Static game build complete. '+(fs.existsSync(path.join(root,'assets'))?'Local assets included.':'The supplied project omits assets; apply the update to your asset-complete game for full presentation.'));
