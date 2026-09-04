const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'themes.css'),'utf8');
const build=fs.readFileSync(path.join(root,'tools','build_v34.cjs'),'utf8');
const checks=[];
function ok(name,fn){fn();checks.push(name);}
ok('theme stylesheet loaded after AAA career pass',()=>{
  assert(html.includes('themes.css?v=v46-2-interface-themes'));
  assert(html.indexOf('themes.css?v=v46-2-interface-themes')>html.indexOf('aaa-career-pass.css'));
});
ok('early theme boot avoids a light-theme flash',()=>{
  assert(html.includes('velmora-manager-interface-theme-v1'));
  assert(html.includes('document.documentElement.dataset.vmTheme'));
});
ok('four requested presentation themes exist',()=>{
  for(const key of ['classic','night','indigo','ember'])assert(app.includes(`${key}:{label:`));
  for(const key of ['night','indigo','ember'])assert(css.includes(`data-vm-theme="${key}"`));
});
ok('theme setting is mounted inside Settings and is presentation-only',()=>{
  assert(app.includes('function mountInterfaceThemeSetting()'));
  assert(app.includes('Changes presentation only. Layout, career data and gameplay stay exactly the same.'));
  assert(app.includes('mountInterfaceThemeSetting();'));
  assert(!/careerPreferences[^\\n]{0,120}interfaceTheme/i.test(app));
});
ok('classic remains the unmodified baseline',()=>{
  assert(css.includes('Classic is intentionally untouched'));
  assert(!css.includes('filter:invert('));
});
ok('theme choice is persistent but not part of career saves',()=>{
  assert(app.includes("localStorage.setItem(VM_INTERFACE_THEME_KEY,theme)"));
  assert(app.includes("localStorage.getItem(VM_INTERFACE_THEME_KEY)"));
});
ok('static production build copies theme CSS',()=>assert(build.includes("'themes.css'")));
console.log(`V46.2 interface theme checks: ${checks.length} passed`);
checks.forEach(x=>console.log(' ✓',x));
