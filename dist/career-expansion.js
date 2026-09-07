(function(root){
  'use strict';
  function create(a){
    const personnel=root.VelmoraPersonnelIdentity||{};
    const roles={scout:'Chief scout',coach:'Assistant coach',medical:'Head of medical',academy:'Academy director',commercial:'Commercial director'};
    const specialisms=['YOUTH','TECHNICAL','PHYSICAL','DEFENSIVE','ATTACKING','VALUE','INTERNATIONAL'];
    const facilities={training:{name:'Training ground',base:180000,days:45},academy:{name:'Youth academy',base:140000,days:40},medical:{name:'Medical centre',base:160000,days:40},stadium:{name:'Stadium expansion',base:350000,days:90}};
    const bounded=(x,l,h)=>Math.max(l,Math.min(h,x));
    const fail=message=>({ok:false,message});
    const success=message=>({ok:true,message});
    const num=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
    function state(){
      const r=a.runtime(),s=r.expansion||(r.expansion={version:2,clubs:{},customClubs:{},precontracts:[],sequence:0});
      s.version=Math.max(2,num(s.version,1));s.transferPayments=Array.isArray(s.transferPayments)?s.transferPayments:[];s.transferAddOns=Array.isArray(s.transferAddOns)?s.transferAddOns:[];return s;
    }
    function id(prefix){return prefix+'-'+(++state().sequence);}
    function rng(key){return a.rng(a.seed()+'-V34-'+key);}
    function staffName(key){const r=rng(key),first=['Adrian','Mira','Rowan','Elara','Dorian','Sera','Cassian','Lina','Niko','Amara','Tomas','Iris'],last=['Vale','Marin','Thorne','Arden','Voss','Bell','Rook','Orin','Sable','Lorne','Morrow','Kestrel'];return first[Math.floor(r()*first.length)]+' '+last[Math.floor(r()*last.length)];}
    const personnelAsset=role=>personnel.asset?.(role)||`assets/career/personnel-v2/${({scout:'chief-scout-raven',coach:'assistant-coach-badger',medical:'medical-lead-frog',academy:'academy-director-fox',commercial:'commercial-director-lynx'}[role]||'assistant-coach-badger')}.png`;
    const fallbackStaffAsset=(p,role)=>personnel.fallbackAsset?.(p,role)||p?.avatar||p?.image||'assets/career/staff/staff_01.png';
    function ensurePersonnelPortraits(d){
      if(!d||!Array.isArray(d.staff))return d;
      Object.keys(roles).forEach(role=>{
        const team=d.staff.filter(p=>p.role===role);if(!team.length)return;
        let lead=team.find(p=>p.personnelLead===role);
        if(!lead){lead=team.find(p=>!p.formerPlayerId)||team[0];lead.personnelLead=role;lead.portrait=personnelAsset(role);}
        team.forEach(p=>{if(p===lead)p.portrait=personnelAsset(role);else if(!p.portrait)p.portrait=fallbackStaffAsset(p,role);});
      });
      d.personnelPortraitVersion=2;return d;
    }
    function department(club=a.club()){
      if(!club)return null;
      const s=state();
      if(!s.clubs[club.id]){
        const scouts=a.legacyScouts(club).map((p,i)=>({...p,key:'legacy-'+club.id+'-'+i,role:'scout',slot:i,wage:350+i*75,joined:a.date(),xp:0,course:null,portrait:i===0?personnelAsset('scout'):fallbackStaffAsset(p,'scout'),personnelLead:i===0?'scout':null}));
        const quality=bounded(35+num(club.reputation,1)*7,35,80);
        const staff=[...scouts,...['coach','medical','academy','commercial'].map((role,i)=>({id:'staff-'+club.id+'-'+role,key:'staff-'+club.id+'-'+role,name:staffName(club.id+role),role,quality,judgement:3,network:3,specialism:role==='academy'?'YOUTH':'TECHNICAL',wage:300+i*100,joined:a.date(),xp:0,course:null,portrait:personnelAsset(role),personnelLead:role}))];
        s.clubs[club.id]={staff,market:{},facilities:{training:1,academy:1,medical:1,stadium:1},projects:[],missions:[],reports:[],youthLeague:null,youthHistory:[],sponsor:null,ledger:[],paidMonths:[],lastDay:null,started:a.date(),nextScoutSlot:2,gateFixtures:[],capacity:Math.round(3000+num(club.reputation,1)*2500),arrears:0};
      }
      const d=s.clubs[club.id];d.legacyCandidates=Array.isArray(d.legacyCandidates)?d.legacyCandidates:[];return ensurePersonnelPortraits(d);
    }
    function notice(club,subject,body,type='STAFF'){if(club.id===a.club()?.id)a.inbox({id:id('V34-MSG'),type,sender:'CLUB MANAGEMENT',subject,preview:body,title:subject,body:[body],date:a.date(),action:type==='YOUTH'?{label:'REVIEW YOUTH RECRUITMENT',route:'youth-recruitment'}:type==='FINANCE'?{label:'REVIEW FINANCES',route:'finances'}:type==='TRANSFERS'?{label:'OPEN TRANSFER HUB',route:'transfers'}:{label:'MANAGE STAFF',route:'staff'}});}
    function transact(club,amount,label,date=a.date()){
      if(!Number.isFinite(amount))throw new Error('Invalid transaction');
      const balance=a.money(club.budget);if(amount<0&&balance+amount<0)return false;
      club.budget=a.format(balance+amount);const d=department(club);d.ledger.unshift({id:id('TX'),date,label,amount,balance:balance+amount});d.ledger=d.ledger.slice(0,180);return true;
    }

    function transferCashPlan(terms={}){
      const fee=Math.max(0,a.money(terms.fee)),count=bounded(Math.round(num(terms.installments,1)),1,3);if(count===1)return{count,upfront:fee,deferred:[]};
      const upfront=Math.min(fee,Math.round(fee*(count===2?.70:.55)/1000)*1000),dates=count===2?[180]:[180,365],deferred=[];let remaining=Math.max(0,fee-upfront);
      dates.forEach((days,index)=>{const amount=index===dates.length-1?remaining:Math.round((remaining/(dates.length-index))/1000)*1000;deferred.push({days,amount});remaining-=amount;});
      return{count,upfront,deferred};
    }
    function transferFinanceState(){const s=state();return{payments:s.transferPayments,addOns:s.transferAddOns};}
    function reservedTransferPayments(club=a.club()){
      if(!club)return 0;const f=transferFinanceState(),guaranteed=f.payments.filter(x=>x.buyerId===club.id&&['SCHEDULED','OVERDUE'].includes(x.status)&&!x.escrowed).reduce((n,x)=>n+num(x.amount),0),triggered=f.addOns.filter(x=>x.buyerId===club.id&&['TRIGGERED','OVERDUE'].includes(x.status)).reduce((n,x)=>n+num(x.amount),0);return guaranteed+triggered;
    }
    function transferAvailableBudget(club=a.club()){return typeof a.availableBudget==='function'?a.availableBudget(club):Math.max(0,a.money(club?.budget)-reservedTransferPayments(club));}
    function structuredOfferCredit(terms={}){const plan=transferCashPlan(terms),guaranteed=plan.upfront+plan.deferred.reduce((n,x)=>n+x.amount*.97,0),addOnWeight=terms.addOnType==='APPEARANCES'?.62:terms.addOnType==='TEAM_WINS'?.48:0;return guaranteed+Math.max(0,num(terms.addOnAmount))*addOnWeight;}
    function createTransferObligations(p,buyer,seller,terms,options={}){
      if(!p||!buyer||!seller)return;const f=transferFinanceState(),plan=transferCashPlan(terms),created=options.created||a.date();plan.deferred.filter(x=>x.amount>0).forEach((row,index)=>f.payments.push({id:id('INST'),playerId:p.id,playerName:p.name,buyerId:buyer.id,sellerId:seller.id,amount:row.amount,due:a.addDays(created,row.days),sequence:index+1,total:plan.count-1,status:'SCHEDULED',escrowed:!!options.escrowed,created}));
      const addOnType=['APPEARANCES','TEAM_WINS'].includes(terms.addOnType)?terms.addOnType:'NONE',amount=Math.max(0,num(terms.addOnAmount));if(addOnType!=='NONE'&&amount>0)f.addOns.push({id:id('ADDON'),playerId:p.id,playerName:p.name,buyerId:buyer.id,sellerId:seller.id,type:addOnType,amount,target:addOnType==='APPEARANCES'?15:10,progress:0,lastApps:num(p.seasonStats?.apps),created,status:'ACTIVE'});
    }
    function clubWinsSince(clubId,date){return a.fixtures().filter(f=>f.played&&f.date>=date&&String(f.type||'').toUpperCase()==='LEAGUE'&&((f.homeClubId===clubId&&f.homeScore>f.awayScore)||(f.awayClubId===clubId&&f.awayScore>f.homeScore))).length;}
    function processTransferPayments(date=a.date()){
      const f=transferFinanceState();for(const row of f.payments.filter(x=>['SCHEDULED','OVERDUE'].includes(x.status)&&x.due<=date)){const buyer=a.clubById(row.buyerId),seller=a.clubById(row.sellerId);if(!buyer||!seller){row.status='CANCELLED';continue;}if(!row.escrowed&&!transact(buyer,-row.amount,'Transfer instalment: '+row.playerName,date)){row.status='OVERDUE';if(row.lastNotice!==date.slice(0,7)){row.lastNotice=date.slice(0,7);notice(buyer,'Transfer instalment overdue',a.format(row.amount)+' remains due for '+row.playerName+'. Uncommitted transfer funds will stay restricted until it is paid.','FINANCE');}continue;}transact(seller,row.amount,'Transfer instalment received: '+row.playerName,date);row.status='PAID';row.paid=date;}
      for(const row of f.addOns.filter(x=>['ACTIVE','TRIGGERED','OVERDUE'].includes(x.status))){const p=a.player(row.playerId),buyer=a.clubById(row.buyerId),seller=a.clubById(row.sellerId);if(!p||!buyer||!seller){row.status='CANCELLED';continue;}if(row.status==='ACTIVE'){if(row.type==='APPEARANCES'){const apps=num(p.seasonStats?.apps),delta=apps>=num(row.lastApps)?apps-num(row.lastApps):apps;row.progress+=Math.max(0,delta);row.lastApps=apps;}else row.progress=clubWinsSince(row.buyerId,row.created);if(row.progress>=row.target){row.status='TRIGGERED';row.triggered=date;}}
        if(!['TRIGGERED','OVERDUE'].includes(row.status))continue;if(!transact(buyer,-row.amount,'Transfer add-on: '+row.playerName,date)){row.status='OVERDUE';continue;}transact(seller,row.amount,'Transfer add-on received: '+row.playerName,date);row.status='PAID';row.paid=date;notice(buyer,'Transfer add-on paid',a.format(row.amount)+' has been paid after '+(row.type==='APPEARANCES'?row.playerName+' reached 15 appearances':'the club reached 10 league wins')+'.','TRANSFERS');}
      f.payments.splice(0,Math.max(0,f.payments.length-240));f.addOns.splice(0,Math.max(0,f.addOns.length-180));
    }
    function market(club=a.club()){
      const d=department(club),month=a.date().slice(0,7);if(d.market.month!==month){
        d.market={month,candidates:Object.keys(roles).flatMap((role)=>Array.from({length:3},(_,i)=>{
          const key=club.id+'-'+month+'-'+role+'-'+i,r=rng(key),quality=Math.round(38+r()*52),wage=Math.round((120+quality*quality*.19)/25)*25;
          const candidate={id:'candidate-'+key,key:'candidate-'+key,name:staffName(key),role,quality,wage,fee:wage*8,judgement:bounded(Math.round(quality/19),1,5),network:bounded(Math.round((quality+8)/20),1,5),specialism:specialisms[Math.floor(r()*specialisms.length)],xp:0,course:null};candidate.portrait=fallbackStaffAsset(candidate,role);return candidate;
        }))};
      }
      const expiredLegacyCandidates=d.legacyCandidates.filter(p=>p.expiresDate&&p.expiresDate<a.date());
      expiredLegacyCandidates.forEach(p=>{if(typeof a.onLegacyStaffExpired==='function')a.onLegacyStaffExpired(p,club);});
      d.legacyCandidates=d.legacyCandidates.filter(p=>!p.expiresDate||p.expiresDate>=a.date());
      const generated=Array.isArray(d.market.candidates)?d.market.candidates:[];return [...d.legacyCandidates,...generated.filter(p=>!d.legacyCandidates.some(x=>x.id===p.id))];
    }
    function addLegacyCandidate(club,candidate){const d=department(club);if(!d||!candidate||!['coach','scout'].includes(candidate.role))return fail('This former-player application is invalid.');if(d.staff.some(p=>p.formerPlayerId===candidate.formerPlayerId)||d.legacyCandidates.some(p=>p.formerPlayerId===candidate.formerPlayerId))return fail('This former player already has an active staff pathway.');d.legacyCandidates.push({...candidate,fee:0});if(club.id===a.club()?.id){staffFilter=candidate.role;staffMode='market';selectedStaffKey=candidate.key;}return success('Former-player application added to the staff market.');}
    function hire(candidateId){const c=a.club();if(!c)return fail('Take a club job first.');const d=department(c),p=market(c).find(x=>x.id===candidateId);if(!p)return fail('This candidate is no longer available.');const limit=p.role==='scout'?5:2;if(d.staff.filter(x=>x.role===p.role).length>=limit)return fail('This department has no vacant positions.');if(!transact(c,-p.fee,'Staff signing: '+p.name))return fail('Insufficient transfer budget for the signing fee.');const hired={...p,joined:a.date(),...(p.role==='scout'?{slot:d.nextScoutSlot++}: {})};d.staff.push(hired);d.market.candidates=d.market.candidates.filter(x=>x.id!==p.id);d.legacyCandidates=d.legacyCandidates.filter(x=>x.id!==p.id);if(p.formerPlayerId&&typeof a.onLegacyStaffHired==='function')a.onLegacyStaffHired(hired,c);notice(c,p.name+' joins the staff',(p.formerPlayerId?'Former '+String(p.formerPlayerRole||'player').toLowerCase()+' · ':'')+roles[p.role]+' · '+a.format(p.wage)+' per week.');return success(p.formerPlayerId?'A former player has returned as a staff member.':'Staff member hired.');}
    function staffBusy(p,d){return d.missions.some(m=>m.staffKey===p.key&&m.status==='ACTIVE')||a.assignments().some(x=>x.scoutId===p.id||Number(x.scoutSlot)===p.slot&&p.role==='scout');}
    function fire(key){const c=a.club(),d=department(c),p=d.staff.find(x=>x.key===key);if(!p)return fail('Staff member not found.');if(staffBusy(p,d)||p.course)return fail('Finish or cancel the assignment or course before releasing this staff member.');if(!transact(c,-p.wage*4,'Staff severance: '+p.name))return fail('Insufficient budget for four weeks of severance.');d.staff=d.staff.filter(x=>x.key!==key);return success('Staff contract ended.');}
    function trainStaff(key){const c=a.club(),d=department(c),p=d.staff.find(x=>x.key===key);if(!p||p.course||p.quality>=95)return fail('This staff member cannot begin another course.');if(staffBusy(p,d))return fail('Recall this scout before starting a course.');const cost=Math.round(p.quality*450);if(!transact(c,-cost,'Staff development: '+p.name))return fail('Insufficient budget for this course.');p.course={end:a.addDays(a.date(),30),gain:3};return success('30-day development course booked.');}
    function scouts(club=a.club()){if(!club)return[];return department(club).staff.filter(p=>p.role==='scout').map(p=>({...p,label:roles.scout,judgement:bounded(Math.round(p.quality/19),1,5),network:bounded(Math.round((p.quality+8)/20),1,5)}));}
    function freeScouts(club=a.club()){const d=department(club);return scouts(club).filter(p=>!p.course&&!staffBusy(p,d));}
    function personnelForRole(role,club=a.club()){if(!club||!roles[role])return null;return departmentLead(department(club),role);}
    function missionCost(region,months){return Math.round((region===a.club()?.world?18000:30000)*months);}
    function sendScout(key,region,role,months){const c=a.club(),d=department(c),p=freeScouts(c).find(x=>x.key===key);months=Number(months);if(!p)return fail('Select an available scout.');if(!a.worlds().includes(region)||!['ANY','ATTACKER','PLAYMAKER','DEFENDER','ALL-ROUNDER'].includes(role)||![1,3,6].includes(months))return fail('Choose a valid region, role and duration.');const cost=missionCost(region,months);if(!transact(c,-cost,'Youth scouting: '+region))return fail('Insufficient budget for this scouting trip.');const m={id:id('MISSION'),staffKey:key,scoutId:p.id,region,role,months,started:a.date(),nextReport:a.addDays(a.date(),30),end:a.addDays(a.date(),months*30),reports:0,status:'ACTIVE'};d.missions.push(m);return success('Scout dispatched. The first report arrives in 30 days.');}
    function cancelMission(missionId){const d=department(),m=d.missions.find(x=>x.id===missionId&&x.status==='ACTIVE');if(!m)return fail('Assignment is no longer active.');m.status='RECALLED';return success('Scout recalled. Travel fees are non-refundable.');}
    function academyCap(club){const d=state().clubs[club?.id];return club?.id===a.club()?.id?6+Math.max(0,(d?.facilities.academy||1)-1)*2:4;}
    function signProspect(reportId){const c=a.club(),d=department(c),report=d.reports.find(x=>x.id===reportId&&x.status==='AVAILABLE');if(!report||report.expires<a.date())return fail('This prospect is no longer available.');if(a.academy(c).length>=academyCap(c))return fail('Your academy is full. Promote or release a player, or upgrade the academy.');if(!transact(c,-report.fee,'Academy signing: '+report.player.name))return fail('Insufficient budget for this academy signing.');a.academy(c).push(report.player);report.status='SIGNED';return success('Prospect added to your academy.');}
    function declineProspect(reportId){const report=department().reports.find(x=>x.id===reportId&&x.status==='AVAILABLE');if(!report)return fail('Prospect not available.');report.status='DECLINED';return success('Prospect declined.');}
    function youthReports(club,date){const d=department(club);for(const m of d.missions.filter(x=>x.status==='ACTIVE')){
      const scout=d.staff.find(x=>x.key===m.staffKey);if(!scout){m.status='CANCELLED';continue;}
      while(m.nextReport<=date&&m.nextReport<=m.end){
        const r=rng(m.id+'-'+m.nextReport),pool=a.clubs().filter(c=>c.world===m.region),source=pool[Math.floor(r()*pool.length)]||club,count=1+(scout.quality>=65?1:0)+(r()<.25?1:0);
        for(let i=0;i<count;i++){
          const p=a.generateYouth(source,++state().sequence,m.id+'-'+m.nextReport);p.id='V34-'+m.id+'-'+m.reports+'-'+i;p.clubId=club.id;p.clubName=club.name;p.careerClubs=[club.id];p.country=source.country;
          if(m.role!=='ANY'){p.role=m.role;p.stats=a.makeStats(p.ovr,p.role,r);}
          p.potential=bounded(p.potential+Math.round((scout.quality-65)/12),p.ovr,94);p.basePotential=p.potential;
          const spread=Math.max(3,Math.round((105-scout.quality)/6));d.reports.unshift({id:id('REPORT'),player:p,scoutName:scout.name,region:m.region,date:m.nextReport,expires:a.addDays(m.nextReport,60),status:'AVAILABLE',fee:Math.round((p.ovr*500)/1000)*1000,ovrLow:Math.max(35,p.ovr-spread),ovrHigh:Math.min(94,p.ovr+spread),potentialLow:Math.max(p.ovr,p.potential-spread),potentialHigh:Math.min(94,p.potential+spread)});
        }m.reports++;notice(club,'Youth scouting report: '+m.region,count+' prospects are ready to review in Squad → Youth Academy → Youth Recruitment.','YOUTH');m.nextReport=a.addDays(m.nextReport,30);
      }if(date>=m.end)m.status='COMPLETE';
    }d.reports.forEach(r=>{if(r.status==='AVAILABLE'&&r.expires<date)r.status='EXPIRED';});d.reports=d.reports.filter(r=>r.status==='AVAILABLE'||a.diffDays(r.date,date)<180).slice(0,150);}
    function youthCompetition(club){
      const d=department(club);if(d.youthLeague?.season===a.season())return d.youthLeague;
      if(d.youthLeague){d.youthHistory.unshift({season:d.youthLeague.season,table:youthTable(d.youthLeague),fixtures:d.youthLeague.fixtures});d.youthHistory=d.youthHistory.slice(0,10);}
      const opponents=a.clubs().filter(c=>c.id!==club.id&&c.world===club.world).sort((x,y)=>a.hash(a.seed()+x.id)-a.hash(a.seed()+y.id)).slice(0,7),teams=[club,...opponents].map(c=>c.id),circle=[...teams],rounds=[];
      for(let round=0;round<7;round++){const games=[];for(let i=0;i<4;i++)games.push([circle[i],circle[7-i]]);rounds.push(games);circle.splice(1,0,circle.pop());}
      for(const opponent of opponents){const squad=a.academy(opponent);while(squad.filter(p=>p.age<=21).length<3)squad.push(a.generateYouth(opponent,++state().sequence,'ACADEMY-LEAGUE'));}
      const startYear=Number(a.season().slice(0,4)),fixtures=[];for(let round=0;round<14;round++)rounds[round%7].forEach(([home,away],i)=>{const date=a.addDays(startYear+'-09-05',round*18);if(date>=a.date())fixtures.push({id:a.season()+'-Y'+round+'-'+i,date,home:round<7?home:away,away:round<7?away:home,played:false});});
      d.youthLeague={season:a.season(),teams,fixtures,selection:[],plan:'BALANCED'};return d.youthLeague;
    }
    function youthTable(league){const rows=new Map(league.teams.map(id=>[id,{id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0}]));league.fixtures.filter(f=>f.played).forEach(f=>{const h=rows.get(f.home),v=rows.get(f.away);h.played++;v.played++;h.gf+=f.hs;h.ga+=f.as;v.gf+=f.as;v.ga+=f.hs;if(f.hs>f.as){h.won++;v.lost++;h.points+=3;}else if(f.hs<f.as){v.won++;h.lost++;v.points+=3;}else{h.drawn++;v.drawn++;h.points++;v.points++;}});return [...rows.values()].sort((x,y)=>y.points-x.points||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||x.id.localeCompare(y.id));}
    function setYouthTeam(ids,plan){const club=a.club(),league=youthCompetition(club),eligible=a.academy(club).filter(p=>!p.injured&&p.age<=21);if(!['BALANCED','DEVELOPMENT','COMPETE'].includes(plan))return fail('Choose a valid academy plan.');if(ids.length!==3||new Set(ids).size!==3||ids.some(id=>!eligible.some(p=>p.id===id)))return fail('Select three different available academy players.');league.selection=ids;league.plan=plan;return success('Academy team saved.');}
    function playYouth(club,date){const league=youthCompetition(club);for(const f of league.fixtures.filter(f=>!f.played&&f.date<=date)){
      const r=rng('youth-'+club.id+'-'+f.id),sides=[f.home,f.away].map(cid=>{const c=a.clubById(cid),squad=a.academy(c).filter(p=>!p.injured&&p.age<=21);if(cid===club.id){const selected=league.selection.map(id=>squad.find(p=>p.id===id)).filter(Boolean);return [...selected,...squad.filter(p=>!selected.includes(p)).sort((x,y)=>y.ovr-x.ovr)].slice(0,3);}return squad.sort((x,y)=>y.ovr-x.ovr).slice(0,3);});
      const avg=list=>list.length?list.reduce((n,p)=>n+p.ovr,0)/list.length:40,preparation=league.plan==='COMPETE'?3:0,delta=(avg(sides[0])-avg(sides[1])+(f.home===club.id?preparation:f.away===club.id?-preparation:0))/15;f.hs=bounded(Math.floor(r()*4+Math.max(0,delta)),0,7);f.as=bounded(Math.floor(r()*4+Math.max(0,-delta)),0,7);
      if(sides[0].length<3&&sides[1].length>=3){f.hs=0;f.as=3;f.forfeit=f.home;}else if(sides[1].length<3&&sides[0].length>=3){f.hs=3;f.as=0;f.forfeit=f.away;}else if(sides.some(x=>x.length<3)){f.hs=0;f.as=0;f.noContest=true;}
      f.played=true;f.participants=sides.map(list=>list.map(p=>({id:p.id,name:p.name})));const own=f.home===club.id?0:f.away===club.id?1:-1;
      if(own>=0&&!f.forfeit&&!f.noContest){sides[own].forEach(p=>{p.academyStats=p.academyStats||{apps:0,minutes:0,growth:0};p.academyStats.apps++;p.academyStats.minutes+=90;p.academyMatchProgress=num(p.academyMatchProgress)+(league.plan==='DEVELOPMENT'?.15:.1);if(p.academyMatchProgress>=1&&p.ovr<p.potential){p.academyMatchProgress--;p.ovr++;Object.keys(p.stats).forEach(k=>p.stats[k]=bounded(p.stats[k]+1,1,94));p.academyStats.growth++;}});}
      if(own>=0)notice(club,'Academy result',a.clubById(f.home).name+' '+f.hs+'–'+f.as+' '+a.clubById(f.away).name+(f.forfeit?' · walkover: fewer than three eligible players.':f.noContest?' · neither team could field three players.':''),'YOUTH');
    }return league;}
    function quoteUpgrade(type,club=a.club()){const d=department(club),spec=facilities[type];if(!spec)return null;const level=d.facilities[type];return{level,cost:spec.base*level*level,days:spec.days+15*(level-1),capacityGain:type==='stadium'?2000+level*1000:0};}
    function upgrade(type){const c=a.club(),d=department(c),q=quoteUpgrade(type,c);if(!q||q.level>=5)return fail('This facility is already at its maximum level.');if(d.projects.some(p=>p.type===type&&p.status==='BUILDING'))return fail('Work is already in progress.');if(!transact(c,-q.cost,facilities[type].name+' construction'))return fail('Insufficient budget for this project.');d.projects.push({id:id('BUILD'),type,level:q.level+1,end:a.addDays(a.date(),q.days),cost:q.cost,capacityGain:q.capacityGain,status:'BUILDING'});return success('Construction approved. Benefits begin when the project finishes.');}
    function sponsorOffers(club=a.club()){const d=department(club),base=Math.round((15000+num(club.reputation,1)*12000)*(1+staffQuality(club,'commercial')/250));return [{id:'community',name:'Community Partnership',monthly:base,upfront:base*2,bonus:base*2,target:0,term:12},{id:'growth',name:'Regional Growth Partner',monthly:Math.round(base*1.3),upfront:base,bonus:base*5,target:4,term:12},{id:'ambition',name:'Championship Partner',monthly:Math.round(base*.85),upfront:base*3,bonus:base*10,target:7,term:12}];}
    function signSponsor(offerId){const c=a.club(),d=department(c);if(d.sponsor?.status==='ACTIVE')return fail('An exclusive sponsor is already under contract.');const o=sponsorOffers(c).find(x=>x.id===offerId);if(!o)return fail('Offer not found.');d.sponsor={...o,status:'ACTIVE',started:a.date(),end:a.addDays(a.date(),365),paid:[],months:0,earned:0};transact(c,o.upfront,o.name+' signing payment');d.sponsor.earned+=o.upfront;return success('Sponsor contract signed for one year.');}
    function staffQuality(club,role){const staff=state().clubs[club?.id]?.staff.filter(p=>p.role===role&&!p.course)||[];return staff.length?Math.max(...staff.map(p=>p.quality)):0;}
    function developmentFactor(p){const c=a.clubById(p.clubId),d=state().clubs[c?.id];if(!d)return 1;return 1+Math.max(0,staffQuality(c,p.academy?'academy':'coach')-50)/250+Math.max(0,d.facilities[p.academy?'academy':'training']-1)*.04;}
    function recoveryBonus(p){const c=a.clubById(p.clubId),d=state().clubs[c?.id];return d?Math.min(2,Math.floor(Math.max(0,staffQuality(c,'medical')-55)/25)+(d.facilities.medical>=3?1:0)):0;}
    function monthly(club,date){const d=department(club),month=date.slice(0,7);if(d.paidMonths.includes(month))return;d.paidMonths.push(month);d.paidMonths=d.paidMonths.slice(-36);
      const wages=d.staff.reduce((n,p)=>n+p.wage,0)*4,maintenance=Object.values(d.facilities).reduce((n,l)=>n+l*1500,0),due=wages+maintenance+d.arrears,available=a.money(club.budget),paid=Math.min(available,due);if(paid)transact(club,-paid,'Staff wages and facility upkeep',date);d.arrears=due-paid;
      if(d.arrears)notice(club,'Operating costs outstanding','We’re still short '+a.format(d.arrears)+' on the bills this month. It’ll roll into next month’s payment if we can’t clear it before then.','FINANCE');
      for(const p of d.staff){if(!p.course){p.xp=num(p.xp)+1;if(p.xp>=3){p.xp=0;p.quality=Math.min(95,p.quality+1);}}}
      const sponsor=d.sponsor;if(sponsor?.status==='ACTIVE'&&sponsor.started.slice(0,7)!==month&&!sponsor.paid.includes(month)&&date<=sponsor.end){const previous=a.addDays(date,-1).slice(0,7),wins=a.fixtures().filter(f=>f.played&&f.date.startsWith(previous)&&((f.homeClubId===club.id&&f.homeScore>f.awayScore)||(f.awayClubId===club.id&&f.awayScore>f.homeScore))).length,bonus=sponsor.target>0&&wins>=sponsor.target?sponsor.bonus:0;transact(club,sponsor.monthly+bonus,sponsor.name+(bonus?' + performance bonus':''),date);sponsor.earned+=sponsor.monthly+bonus;sponsor.paid.push(month);sponsor.months++;}
    }
    function daily(date){seedClauses();for(const [clubId,d] of Object.entries(state().clubs)){const club=a.clubById(clubId);if(!club||d.lastDay===date)continue;
      for(const p of d.staff)if(p.course&&p.course.end<=date){p.quality=Math.min(95,p.quality+p.course.gain);p.course=null;notice(club,p.name+' completes development','The extra coursework has paid off — '+p.name+' is back at work with quality up to '+p.quality+'.');}
      for(const project of d.projects)if(project.status==='BUILDING'&&project.end<=date){d.facilities[project.type]=project.level;d.capacity+=project.capacityGain;project.status='COMPLETE';project.completedDate=date;notice(club,facilities[project.type].name+' ready','The building work is finished — '+facilities[project.type].name+' is up and running at Level '+project.level+'.','FINANCE');if(typeof a.facilityCompleted==='function')a.facilityCompleted(club,{...project},date);}
      if(date.endsWith('-01'))monthly(club,date);
      if(d.sponsor?.status==='ACTIVE'&&date>d.sponsor.end){d.sponsor.status='EXPIRED';notice(club,'Sponsor contract expired','Choose a new commercial partner in Office → Finances → Sponsors.','FINANCE');}
      youthReports(club,date);playYouth(club,date);
      for(const f of a.fixtures().filter(f=>f.played&&f.homeClubId===club.id&&f.date>=(d.started||date)&&f.date<=date&&!d.gateFixtures.includes(f.fixtureId))){const fill=.5+rng('gate-'+f.fixtureId)()*.35,revenue=Math.round(d.capacity*fill*(8+num(club.reputation,1)));transact(club,revenue,'Home match receipts: '+a.clubById(f.awayClubId)?.name,f.date);d.gateFixtures.push(f.fixtureId);}
      d.gateFixtures=d.gateFixtures.slice(-80);d.lastDay=date;
    }processPrecontracts(date);processTransferPayments(date);}
    
    // Transfer agreements and interface are defined below.
    // Existing contracts keep a fixed buyout as a player's market value changes.
    function seedClauses(){
      if(state().clausePolicyVersion===2)return;
      for(const club of a.clubs())for(const p of a.squad(club)){
        if(p.v35ClauseChecked)continue;
        const value=a.value(p),oldAmount=Math.round(value*(1.6+(a.hash(p.id)%8)/10)/1000)*1000;
        const amended=Object.values(state().clubs||{}).some(d=>(d.ledger||[]).some(t=>t.label==='Contract amendment: '+p.name));
        const oldAutomatic=!amended&&!['TRANSFER','RENEWAL'].includes(p.lastContractReason)&&p.v34ClauseChecked&&a.hash(a.seed()+'clause'+p.id)%5===0&&p.releaseClause===oldAmount&&!p.releaseClauseOrigin;
        // V34 didn't record provenance. Only migrate an exact old generated quote;
        // preserve other existing amounts and explicit no-clause contracts.
        if(oldAutomatic)delete p.releaseClause;
        if((!p.v34ClauseChecked||oldAutomatic)&&!p.releaseClause&&a.hash(a.seed()+'clause'+p.id)%10===0){
          const bands=[.65,.8,.95,1.1,1.35,1.6,1.9,2.2,2.5,2.8];
          const amount=Math.max(1000,Math.round(value*bands[a.hash('buyout-price-'+p.id)%bands.length]/1000)*1000);
          p.releaseClause=amount;p.releaseClauseOrigin={type:'generated',amount,atValue:value};
        }
        p.v35ClauseChecked=true;
      }
      state().clausesSeeded=true;state().clausePolicyVersion=2;
    }
    function validateClause(p,amount){const n=a.money(amount);if(!Number.isFinite(n)||n<0)return fail('Enter a valid release clause, or choose no clause.');if(n&&(n<a.value(p)*.6||n>a.value(p)*3))return fail('For a new clause, the board requires at least 60% of current value and the agent accepts at most three times that value.');return success('Contract clause agreed.');}
    function setClause(p,amount){const n=a.money(amount);if(n>0)p.releaseClause=n;else delete p.releaseClause;p.releaseClauseOrigin={type:'negotiated',amount:n};p.v34ClauseChecked=true;p.v35ClauseChecked=true;}

    function quoteSale(offerId,percent){const c=a.club(),offer=a.sales().find(o=>o.id===offerId&&o.sellerClubId===c.id&&['OPEN','COUNTERED','FINAL_OFFER'].includes(o.status)),p=offer?a.player(offer.playerId):null;percent=Number(percent);if(!offer||!p||!Number.isFinite(percent)||percent<0||percent>30)return fail('This incoming offer is unavailable.');const fee=Number(offer.currentFee||offer.offer||offer.amount||offer.currentOffer||offer.fee||0);if(!fee)return fail('The buyer has not made a valid cash offer.');const quote={id:id('SALE'),offerId,playerId:p.id,playerName:p.name,fee:Math.round(fee*(1-percent/200)),percent,buyerId:offer.buyerClubId,sellerId:c.id,expires:offer.expiresDate,status:'QUOTED'};state().saleQuotes=(state().saleQuotes||[]).filter(q=>q.status==='QUOTED').slice(-20);state().saleQuotes.push(quote);return success('Adjusted sale quoted: '+a.format(quote.fee)+' now plus '+percent+'% of the next transfer. Review and confirm below.');}
    function confirmSale(quoteId){const c=a.club(),quote=(state().saleQuotes||[]).find(q=>q.id===quoteId&&q.status==='QUOTED'&&q.sellerId===c.id),offer=quote?a.sales().find(o=>o.id===quote.offerId):null,p=quote?a.player(quote.playerId):null,buyer=quote?a.clubById(quote.buyerId):null;if(!quote||!offer||!p||!buyer||!['OPEN','COUNTERED','FINAL_OFFER'].includes(offer.status)||quote.expires<a.date())return fail('This sale is no longer available.');if(!a.windowOpen())return fail('The transfer window is closed.');if(!a.sell(offer,p,buyer,quote.fee))return fail('The buyer cannot complete this deal.');if(quote.percent)p.v34SellOn={beneficiary:c.id,owedBy:buyer.id,percent:quote.percent};quote.status='COMPLETED';return success('Sale completed with '+quote.percent+'% of the next transfer retained.');}
    function reservedPlaces(club){return state().precontracts.filter(p=>p.buyerId===club?.id&&p.status==='SIGNED').length;}
    function reservedWages(club){return state().precontracts.filter(p=>p.buyerId===club?.id&&p.status==='SIGNED').reduce((n,p)=>n+p.terms.wage,0);}
    function target(id){const p=a.player(id);if(!p)return null;const owner=p.freeAgent?null:a.clubById(p.ownerClubId||p.clubId);return {p,owner};}
    function normalTerms(input){return {fee:a.money(input.fee),wage:a.money(input.wage),bonus:a.money(input.bonus),years:Number(input.years),role:input.role||'Rotation',sellOn:Number(input.sellOn||0),releaseClause:a.money(input.releaseClause),swapId:input.swapId||null,optionFee:a.money(input.optionFee),wageShare:Number(input.wageShare??100),installments:bounded(Math.round(Number(input.installments||1)),1,3),addOnType:['NONE','APPEARANCES','TEAM_WINS'].includes(input.addOnType)?input.addOnType:'NONE',addOnAmount:a.money(input.addOnAmount)};}
    function termsValid(t){return [t.fee,t.wage,t.bonus,t.releaseClause,t.optionFee,t.addOnAmount].every(v=>Number.isFinite(v)&&v>=0)&&Number.isInteger(t.years)&&t.years>=1&&t.years<=5&&['Crucial','Important','Rotation','Prospect','Reserve','Sporadic'].includes(t.role)&&Number.isFinite(t.sellOn)&&t.sellOn>=0&&t.sellOn<=30&&Number.isFinite(t.wageShare)&&t.wageShare>=0&&t.wageShare<=100&&Number.isInteger(t.installments)&&t.installments>=1&&t.installments<=3&&['NONE','APPEARANCES','TEAM_WINS'].includes(t.addOnType);}
    function proposal(playerId,kind,input){
      const c=a.club(),found=target(playerId);if(!c||!found)return fail('Player not found.');const {p,owner}=found,t=normalTerms(input);
      if(!termsValid(t))return fail('Check the money amounts, contract length and clause percentages.');
      if(!['TRANSFER','RELEASE','SWAP','PRECONTRACT','LOAN_BUY'].includes(kind))return fail('Select a deal type.');
      if(owner?.id===c.id||p.academy||p.onLoan||p.v34Precontract)return fail('This player is not available for this agreement.');
      if(!p.freeAgent&&!owner)return fail('The selling club is unavailable.');
      if(['SWAP','LOAN_BUY'].includes(kind)&&!a.windowOpen())return fail('Loans and player exchanges require an open transfer window. Permanent transfers can be agreed now for the next window.');
      if(a.squad(c).length+a.ownedLoans(c)+reservedPlaces(c)>=(a.squadCap(c)+(kind==='SWAP'?1:0)))return fail('The senior squad has no uncommitted places.');
      if(kind==='PRECONTRACT'&&(!owner||p.age<23||!p.contractEndDate||a.diffDays(a.date(),p.contractEndDate)>183||p.contractEndDate<a.date()))return fail('Pre-contracts are available for players aged 23+ with at most six months remaining.');
      if(kind==='RELEASE'){if(!num(p.releaseClause)||!owner)return fail('This player has no release clause.');t.fee=p.releaseClause;t.sellOn=0;}
      if(kind==='PRECONTRACT')t.fee=0;
      if(p.freeAgent)t.fee=0;
      if(['RELEASE','PRECONTRACT','LOAN_BUY'].includes(kind)||p.freeAgent){t.installments=1;t.addOnType='NONE';t.addOnAmount=0;}
      if(t.addOnType==='NONE')t.addOnAmount=0;
      if(kind==='LOAN_BUY'&&(!owner||t.optionFee<a.value(p)*.8||p.captain||a.squad(owner).length<=3))return fail('The club needs a non-captain it can spare and a buy option worth at least 80% of market value.');
      const swap=kind==='SWAP'?a.squad(c).find(x=>x.id===t.swapId):null;
      if(kind==='SWAP'&&(!swap||swap.captain||swap.onLoan||swap.v34Precontract||swap.id===p.id||a.squad(c).length<=3||!owner))return fail('Choose an available non-captain from your senior squad.');
      if(swap&&(a.interest({...swap,club:c},owner)==='NONE'||!a.canWage(owner,swap,swap.wage)))return fail('The exchange player will not join that club on the current wage allocation.');
      if(a.interest({...p,club:owner},c)==='NONE'&&kind!=='LOAN_BUY')return fail('The player is not interested in joining your club.');
      const wage=kind==='LOAN_BUY'?Math.round(p.wage*t.wageShare/100):t.wage;
      if(a.weeklyWages(c)+reservedWages(c)+wage-(swap?.wage||0)>Math.max(a.wageBudget(c),a.weeklyWages(c)))return fail('The agreement exceeds the available wage allocation, including future commitments.');
      if(t.addOnAmount>Math.max(50_000,a.value(p)*.35))return fail('Conditional add-ons cannot exceed 35% of the player’s current market value.');
      const cashPlan=transferCashPlan(t),cost=cashPlan.upfront+(kind==='LOAN_BUY'?0:t.bonus),committed=t.fee+(kind==='LOAN_BUY'?0:t.bonus);if(transferAvailableBudget(c)<committed)return fail('The club cannot cover the guaranteed fee, signing bonus and existing transfer commitments.');
      if(kind!=='LOAN_BUY'&&t.wage<a.expectedWage(p)*.85)return fail('The agent wants at least '+a.format(Math.ceil(a.expectedWage(p)*.85))+' per week.');
      if(t.releaseClause>0&&t.releaseClause<a.value(p)*.6)return fail('The board will not approve a release clause below 60% of market value.');
      return {ok:true,p,owner,terms:t,kind,swap,cost,committed,cashPlan};
    }
    function proposeDeal(playerId,kind,input){
      const quote=proposal(playerId,kind,input);if(!quote.ok)return quote;const {p,owner,terms:t,swap}=quote;
      let result={outcome:'accepted'};
      if(owner&&['TRANSFER','SWAP'].includes(kind)){
        const nonCashCredit=(swap?a.value(swap)*.8:0)+a.value(p)*t.sellOn/100*.45,packageCredit=structuredOfferCredit(t)+nonCashCredit;
        result=a.evaluateClub({...p,club:owner},packageCredit);
        if(result.outcome!=='accepted')return {ok:false,message:result.title+' '+(result.counter?'The guaranteed fee must improve toward '+a.format(Math.max(0,Math.ceil(result.counter-nonCashCredit)))+'. ':'')+(result.copy||'')};
      }
      if(kind==='LOAN_BUY'&&t.fee<a.value(p)*.04)return fail('The club requests a loan fee of at least '+a.format(Math.ceil(a.value(p)*.04))+'.');
      const offer={id:id('AGREEMENT'),buyerId:a.club().id,sellerId:owner?.id||null,playerId:p.id,kind,terms:t,status:'AGREED',expires:a.addDays(a.date(),3),created:a.date()};state().offers=state().offers||[];state().offers=state().offers.filter(x=>x.status==='AGREED'&&x.expires>=a.date()).slice(-30);state().offers.push(offer);
      return {ok:true,message:'Terms agreed. Review the full package and confirm to commit.',offer};
    }
    function onTransfer(p,from,to,fee){
      const clause=p.v34SellOn;if(clause&&clause.owedBy===from?.id&&fee>0){const beneficiary=a.clubById(clause.beneficiary),payment=Math.floor(fee*clause.percent/100);if(beneficiary&&payment){transact(from,-payment,'Sell-on payment: '+p.name);transact(beneficiary,payment,'Sell-on received: '+p.name);notice(beneficiary,'Sell-on clause paid',a.format(payment)+' received following '+p.name+'’s transfer.','FINANCE');}}
      delete p.v34SellOn;delete p.releaseClause;delete p.releaseClauseOrigin;
    }
    function move(p,from,to,fee,t){
      const source=from?a.squad(from):a.freeAgents(),index=source.findIndex(x=>x.id===p.id);if(index<0)throw new Error('Player registration changed.');
      if(from)a.removeLineup(from,p.id);source.splice(index,1);p.freeAgent=false;p.clubId=to.id;p.ownerClubId=to.id;p.clubName=to.name;p.onLoan=false;p.parentClubId=null;p.transferListed=false;p.loanListed=false;p.transferRequested=false;p.transferStatus='LISTEN';p.careerClubs=[...new Set([...(p.careerClubs||[]),to.id])];
      a.setContract(p,to,t.years,t.wage,t.role,a.date(),'TRANSFER');a.squad(to).push(p);a.addLineup(to,p.id,'reserve');a.recordTransfer(p,from,to,fee,{type:from?'PERMANENT':'FREE_AGENT',source:'V34_AGREEMENT'});
      setClause(p,t.releaseClause);if(t.sellOn&&from)p.v34SellOn={beneficiary:from.id,owedBy:to.id,percent:t.sellOn};
    }
    function scheduleTransfer(playerId,input){
      const c=a.club(),found=target(playerId),t=normalTerms(input),joinDate=a.nextWindow();
      if(!c||!found||!found.owner||found.owner.id===c.id||found.p.onLoan||found.p.academy||found.p.v34Precontract||a.windowOpen()||!joinDate)return fail('This future transfer is unavailable.');
      if(!termsValid(t))return fail('Check the agreed contract terms.');
      if(a.squad(c).length+a.ownedLoans(c)+reservedPlaces(c)>=a.squadCap(c))return fail('The senior squad has no uncommitted places.');
      if(!a.canWage(c,found.p,t.wage))return fail('The agreement exceeds the available wage allocation, including future commitments.');
      const {p,owner}=found,cost=t.fee+t.bonus;
      if(!transact(c,-cost,'Future transfer funds reserved: '+p.name))return fail('Insufficient funds.');
      const agreement={id:id('FUTURE'),kind:'TRANSFER',playerId:p.id,playerName:p.name,buyerId:c.id,sellerId:owner.id,joinDate,terms:t,escrow:cost,status:'SIGNED',created:a.date(),previousTransferStatus:p.transferStatus};
      state().precontracts.push(agreement);p.v34Precontract=agreement.id;p.transferStatus='NOT_FOR_SALE';
      a.memory?.({type:'FUTURE_TRANSFER_AGREED',clubId:c.id,playerId:p.id,date:a.date(),transferId:agreement.id,importance:'NOTABLE',metadata:{fromClubId:owner.id,toClubId:c.id,joinDate,fee:t.fee,bonus:t.bonus,wage:t.wage,agreementKind:'TRANSFER'}});
      notice(c,'Deal agreed: '+p.name,p.name+' will join us on '+joinDate+'. Until then, the player stays with '+owner.name+'. We have set aside '+a.format(cost)+' for the fee and bonus, one squad place and '+a.format(t.wage)+' per week. Salary payments begin on arrival.','TRANSFERS');
      return {ok:true,deferred:true,joinDate,message:'Future transfer signed. Arrival: '+joinDate+'.',agreement};
    }
    function confirmDeal(offerId){
      const offer=(state().offers||[]).find(o=>o.id===offerId&&o.status==='AGREED');if(!offer||offer.buyerId!==a.club()?.id||offer.expires<a.date())return fail('This agreement has expired or is already completed.');
      const q=proposal(offer.playerId,offer.kind,offer.terms);if(!q.ok)return q;const {p,owner,terms:t,swap,cashPlan}=q,c=a.club();
      if(offer.sellerId!==owner?.id&&!(offer.sellerId===null&&!owner))return fail('The player has changed clubs. Restart negotiations.');
      if(offer.kind==='PRECONTRACT'){
        if(!transact(c,-t.bonus,'Pre-contract signing bonus: '+p.name))return fail('Insufficient funds.');
        const agreement={id:id('PRE'),playerId:p.id,playerName:p.name,buyerId:c.id,sellerId:owner.id,joinDate:a.addDays(p.contractEndDate,1),terms:t,status:'SIGNED',created:a.date()};state().precontracts.push(agreement);p.v34Precontract=agreement.id;p.transferStatus='NOT_FOR_SALE';offer.status='COMPLETED';a.memory?.({type:'FUTURE_TRANSFER_AGREED',clubId:c.id,playerId:p.id,date:a.date(),transferId:agreement.id,importance:'NOTABLE',metadata:{fromClubId:owner.id,toClubId:c.id,joinDate:agreement.joinDate,fee:0,bonus:t.bonus,wage:t.wage,agreementKind:'PRECONTRACT'}});notice(c,'Future signing agreed: '+p.name,'Joins on '+agreement.joinDate+'. '+a.format(t.wage)+' per week is reserved.','TRANSFERS');return success('Pre-contract signed. The squad place and wages are reserved.');
      }
      if(['TRANSFER','RELEASE'].includes(offer.kind)&&owner&&!a.windowOpen()){
        const result=scheduleTransfer(p.id,t);if(result.ok)offer.status='COMPLETED';return result;
      }
      if(offer.kind==='LOAN_BUY'){
        // The existing loan engine preserves ownership, wages, appearances and returns.
        const ok=a.loan({id:id('LOAN-OFFER'),parentClubId:owner.id,expectedRole:t.role,wageContribution:t.wageShare},p,c);if(!ok)return fail('The loan registration could not be completed.');
        transact(c,-t.fee,'Loan fee: '+p.name);transact(owner,t.fee,'Loan fee received: '+p.name);const loan=a.loans().find(l=>l.playerId===p.id&&l.status==='ACTIVE');loan.buyOption={fee:t.optionFee,terms:t,buyerId:c.id,status:'AVAILABLE'};offer.status='COMPLETED';return success('Loan completed with an optional permanent purchase.');
      }
      // Validate every side before moving either player; all mutations commit synchronously.
      transact(c,-q.cost,'Transfer package upfront: '+p.name);if(owner)transact(owner,cashPlan.upfront,'Transfer upfront received: '+p.name);
      if(swap){const swapValue=Math.round(a.value(swap)*.8);move(swap,c,owner,0,{years:Math.max(1,swap.contractYears||2),wage:swap.wage,role:'Rotation',sellOn:0,releaseClause:0});}
      move(p,owner,c,t.fee,t);if(owner)createTransferObligations(p,c,owner,t);offer.status='COMPLETED';a.finishRecruitment(p.id);const structure=cashPlan.count>1?' · '+cashPlan.count+' guaranteed payments':'';notice(c,'Transfer completed: '+p.name,'It’s done — '+p.name+' is ours for '+a.format(t.fee)+(swap?' plus '+swap.name:'')+structure+', on '+a.format(t.wage)+' a week.','TRANSFERS');return success('Transfer completed.');
    }
    function exerciseOption(loanId){
      const c=a.club(),loan=a.loans().find(l=>l.id===loanId&&l.status==='ACTIVE'),option=loan?.buyOption,p=loan?a.player(loan.playerId):null,owner=loan?a.clubById(loan.parentClubId):null;
      if(!option||option.status!=='AVAILABLE'||option.buyerId!==c?.id||!p||!owner)return fail('This buy option is unavailable.');if(!a.windowOpen())return fail('Buy options can be exercised in a transfer window.');
      const t=option.terms,extraWage=t.wage-Math.round(p.wage*loan.wageContribution/100);if(a.weeklyWages(c)+reservedWages(c)+extraWage>Math.max(a.wageBudget(c),a.weeklyWages(c)))return fail('The permanent wage exceeds your wage allocation.');
      if(a.money(c.budget)<option.fee+t.bonus)return fail('Insufficient budget for the option and signing bonus.');
      transact(c,-option.fee-t.bonus,'Loan buy option: '+p.name);transact(owner,option.fee,'Loan option received: '+p.name);
      loan.status='PURCHASED';option.status='EXERCISED';p.onLoan=false;p.ownerClubId=c.id;p.parentClubId=null;p.loanEndDate=null;a.setContract(p,c,t.years,t.wage,t.role,a.date(),'TRANSFER');a.recordTransfer(p,owner,c,option.fee,{type:'PERMANENT',source:'LOAN_BUY_OPTION'});setClause(p,t.releaseClause);if(t.sellOn)p.v34SellOn={beneficiary:owner.id,owedBy:c.id,percent:t.sellOn};return success('Buy option exercised. The player is now permanently registered.');
    }
    function processPrecontracts(date){
      for(const agreement of state().precontracts.filter(p=>p.status==='SIGNED'&&p.joinDate<=date)){
        const p=a.player(agreement.playerId),buyer=a.clubById(agreement.buyerId),seller=a.clubById(agreement.sellerId),deferred=agreement.kind==='TRANSFER';
        const refund=deferred?num(agreement.escrow):agreement.terms.bonus;
        const cancel=()=>{
          agreement.status='CANCELLED';agreement.completed=date;
          if(p&&p.v34Precontract===agreement.id){delete p.v34Precontract;p.transferStatus=agreement.previousTransferStatus||'LISTEN';}
          if(buyer){transact(buyer,refund,'Future signing refund: '+agreement.playerName);a.memory?.({type:'FUTURE_TRANSFER_CANCELLED',clubId:buyer.id,playerId:agreement.playerId,date,transferId:agreement.id,importance:'NOTABLE',metadata:{fromClubId:agreement.sellerId,toClubId:buyer.id,joinDate:agreement.joinDate,refund,agreementKind:agreement.kind||'PRECONTRACT'}});notice(buyer,'Future move cancelled: '+agreement.playerName,'The player is no longer available. '+a.format(refund)+' has been returned and the reserved squad place and wage allocation released.','TRANSFERS');}
          agreement.escrow=0;
        };
        if(!p||!buyer||p.retiringAtEnd||p.retired){cancel();continue;}
        if(a.squad(buyer).some(x=>x.id===p.id)){agreement.status='COMPLETED';delete p.v34Precontract;continue;}
        const currentOwner=p.freeAgent?null:a.clubById(p.clubId);
        if((currentOwner&&currentOwner.id!==seller?.id)||(deferred&&!seller)||p.onLoan||!(currentOwner?a.squad(currentOwner):a.freeAgents()).some(x=>x.id===p.id)){cancel();continue;}
        // Reserved places remain counted until registration, including across save/load.
        if(a.squad(buyer).length+a.ownedLoans(buyer)>=a.squadCap(buyer)){cancel();continue;}
        const fee=deferred?agreement.terms.fee:0,cashPlan=transferCashPlan(agreement.terms);
        if(deferred&&seller)transact(seller,cashPlan.upfront,'Future transfer upfront received: '+p.name);
        delete p.v34Precontract;move(p,currentOwner,buyer,fee,agreement.terms);
        if(deferred&&seller)createTransferObligations(p,buyer,seller,agreement.terms,{escrowed:true,created:date});
        agreement.status='COMPLETED';agreement.completed=date;agreement.escrow=0;
        a.finishRecruitment(p.id);
        notice(buyer,(deferred?'New signing arrives: ':'Pre-contract arrival: ')+p.name,'The player has joined and is available in the senior squad. Agreed wages now begin.','TRANSFERS');
      }
    }
    function negotiateClause(playerId,amount){const c=a.club(),p=a.squad(c).find(p=>p.id===playerId);amount=a.money(amount);if(!p||p.onLoan||p.v34Precontract)return fail('This player cannot negotiate a contract amendment.');if(!Number.isFinite(amount)||amount<0)return fail('Enter a valid release clause.');const value=a.value(p),existing=num(p.releaseClause);if(amount>value*3)return fail('The agent rejects a clause above three times market value.');if(amount>0&&amount<value*.6)return fail('The board rejects a clause below 60% of market value.');const compensation=Math.round(p.wage*(amount===0?8:4));if(!transact(c,-compensation,'Contract amendment: '+p.name))return fail('Insufficient budget for the agent’s amendment fee.');setClause(p,amount);return success(amount?'Release clause agreed.':'Release clause removed by mutual agreement.');}
    function restoreCustom(){for(const [clubId,identity] of Object.entries(state().customClubs||{})){const club=a.clubById(clubId);if(club)Object.assign(club,identity);}}
    /* ---- Badge maker: shape + fill pattern + emblem + two colours, baked into one self-contained SVG. ---- */
    function crestShapePath(kind){
      if(kind==='round')return '<circle cx="50" cy="50" r="46"/>';
      if(kind==='diamond')return '<path d="M50 3 97 50 50 97 3 50Z"/>';
      if(kind==='hexagon')return '<polygon points="50,4 89.8,27 89.8,73 50,96 10.2,73 10.2,27"/>';
      if(kind==='pentagon')return '<polygon points="50,4 93.7,35.8 77,87.2 23,87.2 6.3,35.8"/>';
      return '<path d="M8 6H92V58Q88 84 50 97Q12 84 8 58Z"/>';
    }
    function crestPatternSvg(pattern,primary,secondary){
      if(pattern==='halves')return '<rect x="0" y="0" width="50" height="100" fill="'+primary+'"/><rect x="50" y="0" width="50" height="100" fill="'+secondary+'"/>';
      if(pattern==='hoops')return '<rect x="0" y="0" width="100" height="100" fill="'+primary+'"/><rect x="0" y="24" width="100" height="16" fill="'+secondary+'"/><rect x="0" y="60" width="100" height="16" fill="'+secondary+'"/>';
      if(pattern==='sash')return '<rect x="0" y="0" width="100" height="100" fill="'+primary+'"/><g transform="rotate(-32 50 50)"><rect x="-20" y="41" width="140" height="20" fill="'+secondary+'"/></g>';
      if(pattern==='chevron')return '<rect x="0" y="0" width="100" height="100" fill="'+primary+'"/><polyline points="14,40 50,72 86,40" fill="none" stroke="'+secondary+'" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>';
      if(pattern==='quarters')return '<rect x="0" y="0" width="50" height="50" fill="'+primary+'"/><rect x="50" y="0" width="50" height="50" fill="'+secondary+'"/><rect x="0" y="50" width="50" height="50" fill="'+secondary+'"/><rect x="50" y="50" width="50" height="50" fill="'+primary+'"/>';
      if(pattern==='ring')return '<rect x="0" y="0" width="100" height="100" fill="'+secondary+'"/><circle cx="50" cy="50" r="30" fill="'+primary+'"/>';
      if(pattern==='stripes')return '<rect x="0" y="0" width="100" height="100" fill="'+primary+'"/><rect x="6" y="0" width="13" height="100" fill="'+secondary+'"/><rect x="43.5" y="0" width="13" height="100" fill="'+secondary+'"/><rect x="81" y="0" width="13" height="100" fill="'+secondary+'"/>';
      return '<rect x="0" y="0" width="100" height="100" fill="'+primary+'"/>';
    }
    // A pattern like Halves or Sash can put an icon/abbreviation on top of a fill that matches its
    // own colour exactly (e.g. secondary-on-secondary), making it invisible. Every icon and the
    // abbreviation text get a halo outline in whichever of black/white contrasts best against the
    // secondary colour itself, so they stay readable no matter which half of the crest they land on.
    function crestHaloColor(hex){
      const h=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#10243b',r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16),lum=(0.299*r+0.587*g+0.114*b)/255;
      return lum>0.55?'#111111':'#ffffff';
    }
    function crestIconSvg(icon,secondary,halo){
      if(icon==='star')return '<polygon points="50,23 52.9,31.8 62.4,32 55,37.6 57.6,46.5 50,41.2 42.4,46.5 45,37.6 37.6,32 47.1,31.8" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke fill"/>';
      if(icon==='ring')return '<circle cx="50" cy="36" r="11" fill="none" stroke="'+halo+'" stroke-width="8"/><circle cx="50" cy="36" r="11" fill="none" stroke="'+secondary+'" stroke-width="4"/>';
      if(icon==='cross')return '<rect x="38" y="30" width="24" height="9" rx="2" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2" paint-order="stroke fill"/><rect x="45.5" y="22.5" width="9" height="24" rx="2" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2" paint-order="stroke fill"/>';
      if(icon==='bolt')return '<polygon points="53,20 41,40 48,40 45,54 59,32 51,32" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke fill"/>';
      if(icon==='wave')return '<path d="M20 36 Q30 24 40 36 T60 36 T80 36" stroke="'+halo+'" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M20 36 Q30 24 40 36 T60 36 T80 36" stroke="'+secondary+'" stroke-width="4" fill="none" stroke-linecap="round"/>';
      if(icon==='crown')return '<path d="M22,48 L22,30 L32,40 L42,22 L50,34 L58,22 L68,40 L78,30 L78,48 Z" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke fill"/>';
      if(icon==='flame')return '<path d="M50,20 C44,28 40,34 40,42 C40,50 45,55 50,55 C55,55 60,50 60,42 C60,36 56,32 53,34 C55,28 53,24 50,20 Z" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke fill"/>';
      if(icon==='leaf')return '<path d="M25,50 Q28,24 75,22 Q72,48 25,50 Z" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke fill"/><path d="M30,46 Q45,34 68,24" stroke="'+halo+'" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M30,46 Q45,34 68,24" stroke="'+secondary+'" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
      if(icon==='paw')return '<ellipse cx="50" cy="44" rx="14" ry="11" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2"/><ellipse cx="32" cy="22" rx="6" ry="8" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2"/><ellipse cx="44" cy="14" rx="6" ry="8" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2"/><ellipse cx="58" cy="14" rx="6" ry="8" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2"/><ellipse cx="70" cy="22" rx="6" ry="8" fill="'+secondary+'" stroke="'+halo+'" stroke-width="2"/>';
      return '';
    }
    function crestData(input,abbr){
      const primary=/^#[0-9a-f]{6}$/i.test(input.primary)?input.primary:'#14b8a6',secondary=/^#[0-9a-f]{6}$/i.test(input.secondary)?input.secondary:'#10243b';
      const shapeKind=['shield','round','diamond','hexagon','pentagon'].includes(input.badge)?input.badge:'shield',shape=crestShapePath(shapeKind);
      const pattern=['solid','halves','hoops','sash','chevron','quarters','ring','stripes'].includes(input.pattern)?input.pattern:'solid';
      const icon=['none','star','ring','cross','bolt','wave','crown','flame','leaf','paw'].includes(input.icon)?input.icon:'none',hasIcon=icon!=='none';
      const textY=hasIcon?70:59,fontSize=hasIcon?20:24,halo=crestHaloColor(secondary);
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">'
        +'<defs><clipPath id="v34c">'+shape+'</clipPath></defs>'
        +'<g clip-path="url(#v34c)">'+crestPatternSvg(pattern,primary,secondary)+'</g>'
        +'<g fill="none" stroke="'+secondary+'" stroke-width="6">'+shape+'</g>'
        +(hasIcon?'<g transform="translate(0,-6)">'+crestIconSvg(icon,secondary,halo)+'</g>':'')
        +'<text x="50" y="'+textY+'" text-anchor="middle" fill="'+secondary+'" stroke="'+halo+'" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill" font-family="Arial,sans-serif" font-size="'+fontSize+'" font-weight="bold">'+abbr+'</text></svg>';
      return 'data:image/svg+xml;base64,'+btoa(svg);
    }
    function updateCreateCrestPreview(form){
      const img=form&&form.querySelector('#v34BadgePreview');if(!img)return;
      const data=new FormData(form),values=Object.fromEntries(data),abbr=(String(values.abbr||'').trim().toUpperCase().slice(0,4))||'NEW';
      img.src=crestData(values,abbr);
    }
    function createClub(input){
      if(a.employed())return fail('Create-a-club is available when starting a new career.');
      const base=a.clubById(input.replaceId),name=String(input.name||'').trim(),abbr=String(input.abbr||'').trim().toUpperCase(),stadium=String(input.stadium||'').trim();
      if(!base||name.length<3||name.length>32||!/^[A-Z0-9]{2,4}$/.test(abbr)||stadium.length<3||stadium.length>40||!/^#[0-9a-f]{6}$/i.test(input.primary)||!/^#[0-9a-f]{6}$/i.test(input.secondary))return fail('Enter a club name, 2–4 letter code, stadium name and two colours.');
      if(a.clubs().some(c=>c.id!==base.id&&c.name.toLowerCase()===name.toLowerCase()))return fail('That club name is already in use.');
      const budgets={community:500000,standard:2000000,ambitious:5000000};if(!Object.hasOwn(budgets,input.budget))return fail('Choose a valid starting budget.');
      a.beginCustom(base,()=>{const identity={name,abbr,stadium,stadiumName:stadium,primaryColor:input.primary,secondaryColor:input.secondary,primary:input.primary,secondary:input.secondary,accent:input.primary,arena:stadium,customClub:true,customBadgeStyle:['shield','round','diamond','hexagon','pentagon'].includes(input.badge)?input.badge:'shield',customBadgePattern:['solid','halves','hoops','sash','chevron','quarters','ring','stripes'].includes(input.pattern)?input.pattern:'solid',customBadgeIcon:['none','star','ring','cross','bolt','wave','crown','flame','leaf','paw'].includes(input.icon)?input.icon:'none',badge:crestData(input,abbr),budget:a.format(budgets[input.budget]),archetype:'Community club'};state().customClubs[base.id]=identity;Object.assign(base,identity);department(base);});
      return success('Your club has entered '+base.division+'.');
    }
    const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const cash=x=>esc(a.format(x));
    const option=(value,label,selected=false)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;
    const select=(name,label,items)=>`<label>${label}<select name="${name}">${items}</select></label>`;
    const field=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`;
    const button=(action,label,key='',danger=false)=>`<button type="button" data-v34-action="${action}" data-key="${esc(key)}" class="${danger?'is-danger':''}">${label}</button>`;
    const empty=text=>`<p class="v34-empty">${text}</p>`;
    let panel=null,overlay=null,view='staff',feedback='',selectedTarget=null,staffFilter='scout',staffMode='team',selectedStaffKey=null,priorFocus=null,confirmation=null,dealKind='TRANSFER';
    const dealDrafts=new Map();
    function close(){if(overlay){overlay.hidden=true;overlay.setAttribute('aria-hidden','true');}const app=document.getElementById('app');if(app)app.inert=false;priorFocus?.focus?.();}
    function bindHost(host,tab){
      host.dataset.v35View=tab;host.classList.add('v35-workspace');
      if(host.dataset.v35Bound)return;host.dataset.v35Bound='true';
      const activate=()=>{if(panel!==host){feedback='';confirmation=null;}panel=host;view=host.dataset.v35View;selectedTarget=host.dataset.v35Target||null;dealKind=host.dataset.v35Kind||dealKind;};
      host.addEventListener('click',activate,true);host.addEventListener('submit',activate,true);
      host.addEventListener('change',event=>{activate();if(event.target.matches('[data-v35-clause-toggle]')){const amount=host.querySelector('[name="releaseClause"]');amount.disabled=!event.target.checked;amount.closest('label').hidden=!event.target.checked;if(!event.target.checked)amount.value='0';}if(event.target.name==='kind'){dealKind=event.target.value;feedback='';render();}});
      ['input','change'].forEach(evtName=>host.addEventListener(evtName,event=>{const form=event.target.closest('[data-v34-form="create"]');if(form)updateCreateCrestPreview(form);}));
      host.addEventListener('click',async event=>{const tab=event.target.closest('[data-v34-tab]');if(tab){view=tab.dataset.v34Tab;feedback='';confirmation=null;render();return;}const b=event.target.closest('[data-v34-action]');if(!b)return;const action=b.dataset.v34Action,key=b.dataset.key;b.disabled=true;
        try{
          if(action==='close'){close();return;}
          if(['staff-filter','staff-mode','staff-select'].includes(action)){
            if(action==='staff-filter'){staffFilter=key;selectedStaffKey=null;}
            if(action==='staff-mode'){staffMode=key==='market'?'market':'team';selectedStaffKey=null;}
            if(action==='staff-select')selectedStaffKey=key;
            confirmation=null;feedback='';render();
            [...host.querySelectorAll('[data-v34-action]')].find(el=>el.dataset.v34Action===action&&el.dataset.key===key)?.focus();return;
          }
          if(action==='cancel-confirm'){confirmation=null;render();return;}
          if(['fire','confirm-deal','confirm-sale','buy-option','recover'].includes(action)){confirmation={action,key};render();return;}
          let result,completedAction=action;
          if(action==='confirm-action'){const pending=confirmation;confirmation=null;if(!pending)return;completedAction=pending.action;result=pending.action==='fire'?fire(pending.key):pending.action==='confirm-deal'?confirmDeal(pending.key):pending.action==='confirm-sale'?confirmSale(pending.key):pending.action==='buy-option'?exerciseOption(pending.key):await recover(Number(pending.key));}
          else if(action==='hire')result=hire(key);else if(action==='train')result=trainStaff(key);else if(action==='recall')result=cancelMission(key);else if(action==='sign-youth')result=signProspect(key);else if(action==='decline-youth')result=declineProspect(key);else if(action==='upgrade')result=upgrade(key);else if(action==='sponsor')result=signSponsor(key);else if(action==='export'){await exportSave(Number(key));return;}
          if(result){if(result.ok){if(completedAction==='hire'){staffMode='team';selectedStaffKey=key;}if(completedAction!=='recover')a.save();a.refresh?.(view,completedAction);if(['confirm-deal','confirm-sale','buy-option'].includes(completedAction))a.toast(result.message);}feedback=result.message;render();}
        }catch(error){feedback=error.message;render();}finally{b.disabled=false;}
      });
      host.addEventListener('submit',async event=>{const form=event.target.closest('[data-v34-form]');if(!form)return;event.preventDefault();const data=new FormData(form),values=Object.fromEntries(data),type=form.dataset.v34Form;let result;try{
        if(type==='mission')result=sendScout(values.scout,values.region,values.role,Number(values.months));
        else if(type==='youth-team')result=setYouthTeam(data.getAll('players'),values.plan);
        else if(type==='deal'){dealDrafts.set(values.playerId+':'+values.kind,{...values,clauseEnabled:!!form.querySelector('[data-v35-clause-toggle]')?.checked});if(form.querySelector('[data-v35-clause-toggle]')?.checked&&!(a.money(values.releaseClause)>0))throw new Error('Enter a buyout amount or untick the optional release clause.');result=proposeDeal(values.playerId,values.kind,values);}
        else if(type==='clause')result=negotiateClause(values.playerId,values.amount);
        else if(type==='sell-deal')result=quoteSale(values.offerId,values.percent);
        else if(type==='create'){result=createClub(values);if(result.ok){close();return;}}
        else if(type==='import'){const file=data.get('save');if(!file?.size)throw new Error('Select a career backup file.');if(file.size>100*1024*1024)throw new Error('The save file is too large.');if(values.confirm!=='yes')throw new Error('Confirm that this will replace the selected slot.');await a.store().importSlot(Number(values.slot),await file.text());a.reloadSlot?.(Number(values.slot));result=success('Backup imported. Use Continue Career to load it.');}
        if(result){if(result.ok){if(type!=='import')a.save();a.refresh?.(view);}feedback=result.message;render();}
      }catch(error){feedback=error.message;render();}});
      host.addEventListener('keydown',event=>{if(host!==overlay)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}if(event.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not([disabled]),input,select,a[href]')].filter(x=>x.offsetParent!==null);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
      return host;
    }
    function open(tab='staff',playerId=null){
      if(tab!=='create'){a.navigate?.(tab,playerId);return;}
      if(!overlay){overlay=document.createElement('div');overlay.id='careerExpansion';overlay.className='v34-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','v34Title');document.body.appendChild(overlay);bindHost(overlay,'create');}
      panel=overlay;view='create';feedback='';confirmation=null;priorFocus=document.activeElement;render();panel.hidden=false;panel.setAttribute('aria-hidden','false');const app=document.getElementById('app');if(app)app.inert=true;panel.querySelector('button')?.focus();
    }
    function embed(host,tab,playerId=null,kind=null){if(!host)return;panel=host;view=tab;selectedTarget=playerId;host.dataset.v35Target=playerId||'';host.dataset.v35Kind=kind||'';if(kind)dealKind=kind;feedback='';confirmation=null;bindHost(host,tab);if(a.club()){department();seedClauses();}render();}
    function render(){if(!panel)return;
      const c=a.club(),bodies={staff:staffHTML,academy:()=>academyHTML('recruitment'),league:()=>academyHTML('league'),facilities:()=>facilitiesHTML('facilities'),commercial:()=>facilitiesHTML('commercial'),ledger:()=>facilitiesHTML('ledger'),deals:dealsHTML,active:()=>agreementsHTML('active'),future:()=>agreementsHTML('future'),loans:()=>agreementsHTML('loans'),sales:()=>salesHTML(selectedTarget),create:createHTML,saves:savesHTML};
      const body=(bodies[view]||staffHTML)();
      let confirm='';if(confirmation){let text='';if(confirmation.action==='fire'){const p=department().staff.find(p=>p.key===confirmation.key);text=`Release ${esc(p?.name)} for ${cash((p?.wage||0)*4)} severance?`;}if(confirmation.action==='confirm-deal'){const o=(state().offers||[]).find(o=>o.id===confirmation.key),plan=transferCashPlan(o?.terms||{}),now=plan.upfront+(o?.kind==='LOAN_BUY'?0:num(o?.terms?.bonus));text=`Commit this ${esc(o?.kind.toLowerCase().replace('_',' '))}? ${cash(now)} is due now against a ${cash(o?.terms.fee||0)} guaranteed fee.`;}if(confirmation.action==='buy-option')text='Exercise this permanent purchase at the agreed fee and signing bonus?';if(confirmation.action==='recover')text='Replace this slot with its previous successful save?';confirm=`<div class="v34-confirm" role="alert"><strong>${text}</strong>${button('cancel-confirm','CANCEL')}${button('confirm-action','CONFIRM')}</div>`;}
      if(confirmation?.action==='confirm-sale'){const q=(state().saleQuotes||[]).find(q=>q.id===confirmation.key);confirm=`<div class="v34-confirm" role="alert"><strong>Sell ${esc(q?.playerName)} for ${cash(q?.fee||0)} plus ${q?.percent||0}% of the next transfer?</strong>${button('cancel-confirm','CANCEL')}${button('confirm-action','CONFIRM SALE')}</div>`;}
      const notice=feedback?`<div class="v34-feedback" role="status">${esc(feedback)}</div>`:'';
      if(view==='saves'&&panel.classList.contains('career-save-slot')){panel.querySelector('.v35-save-status')?.remove();panel.insertAdjacentHTML('beforeend',`<div class="v35-save-status">${notice}${confirm}</div>`);return;}
      if(view==='create')panel.innerHTML=`<section class="v34-shell"><header class="v34-header"><div><span>YOUR NEXT CHAPTER</span><h2 id="v34Title">CREATE A CLUB</h2></div>${button('close','CLOSE ×')}</header>${notice}${confirm}<main class="v34-content">${body}</main></section>`;
      else panel.innerHTML=`${notice}${confirm}<div class="v34-content">${body}</div>`;
      if(view==='deals'){const draft=dealDrafts.get(selectedTarget+':'+dealKind),form=panel.querySelector('[data-v34-form="deal"]');if(draft&&form){for(const [key,value] of Object.entries(draft)){const input=form.elements.namedItem(key);if(input)input.value=value;}const toggle=form.querySelector('[data-v35-clause-toggle]'),amount=form.elements.namedItem('releaseClause');toggle.checked=!!draft.clauseEnabled;amount.disabled=!toggle.checked;amount.closest('label').hidden=!toggle.checked;}}
      if(view==='create')updateCreateCrestPreview(panel.querySelector('[data-v34-form="create"]'));

    }
    const staffDepartments={
      scout:{name:'Scouting',verb:'Find your next signing',description:'Discover senior targets and bring youth prospects into the academy.'},
      coach:{name:'First team',verb:'Help your players improve',description:'Your strongest available coach sets the staff bonus for senior development.'},
      medical:{name:'Medical',verb:'Keep the squad ready',description:'Your strongest available specialist supports daily fitness recovery.'},
      academy:{name:'Academy',verb:'Develop the next generation',description:'Your strongest available academy coach sets the staff bonus for youth development.'},
      commercial:{name:'Commercial',verb:'Build better partnerships',description:'Your strongest available director improves the value of new sponsor offers.'}
    };
    const staffInitials=p=>esc(p.name.split(' ').map(x=>x[0]).slice(0,2).join(''));
    const staffPortrait=p=>esc(p?.portrait||p?.avatar||p?.image||fallbackStaffAsset(p,p?.role));
    function departmentLead(d,role){const team=(d?.staff||[]).filter(p=>p.role===role);return team.find(p=>p.personnelLead===role)||[...team].sort((x,y)=>Number(y.quality||0)-Number(x.quality||0))[0]||null;}
    function personnelBrief(d,role,eyebrow,copy){
      const p=departmentLead(d,role),profile=personnel.profile?.(role)||{title:roles[role]};
      return `<section class="v97-personnel-brief" style="--personnel-accent:${esc(profile.accent||'#0b70bf')}" aria-label="${esc(profile.title||roles[role])}"><span class="v97-personnel-art" aria-hidden="true"><img src="${staffPortrait(p||{role,portrait:personnelAsset(role)})}" alt=""></span><div class="v97-personnel-copy"><span>${esc(eyebrow)}</span><h3>${esc(p?.name||profile.title||roles[role])}</h3><p>${esc(copy)}</p></div><span class="v97-personnel-status"><strong>${esc(profile.title||roles[role])}</strong><small>${p?esc(staffStatus(p)).toUpperCase():'VACANT'}</small></span></section>`;
    }
    function staffStatus(p){return p.course?'On a course':staffBusy(p,department())?'On assignment':'Ready for work';}
    function staffImpact(role,quality){
      if(role==='scout')return 'Judgement '+bounded(Math.round(quality/19),1,5)+'/5 · reach '+bounded(Math.round((quality+8)/20),1,5)+'/5';
      if(role==='medical')return '+'+Math.floor(Math.max(0,quality-55)/25)+' daily fitness from staff';
      if(role==='commercial')return '+'+(quality/250*100).toFixed(1).replace('.0','')+'% to new sponsor offers';
      return '+'+(Math.max(0,quality-50)/250*100).toFixed(1).replace('.0','')+'% staff development bonus';
    }
    function staffCard(p,available=false){
      const c=a.club(),d=department(c),role=p.role,busy=!available&&staffBusy(p,d),budget=a.money(c.budget),own=d.staff.filter(s=>s.role===role),limit=role==='scout'?5:2,full=own.length>=limit;
      const best=own.length?Math.max(...own.map(s=>s.quality)):null,diff=best===null?null:p.quality-best,courseCost=Math.round(p.quality*450),canTrain=!p.course&&!busy&&p.quality<95;
      const disabledHire=full||budget<p.fee,disabledTrain=!canTrain||budget<courseCost,disabledFire=!!p.course||busy||budget<p.wage*4;
      const action=(type,label,disabled,danger=false)=>button(type,label,available?p.id:p.key,danger).replace('<button ',`<button ${disabled?'disabled ':''}`);
      const compare=best===null?'First appointment in this department':diff>0?'+'+diff+' quality above your best '+roles[role].toLowerCase():diff===0?'Matches your best '+roles[role].toLowerCase():Math.abs(diff)+' quality below your best '+roles[role].toLowerCase();
      return `<article class="v36-staff-dossier ${p.formerPlayerId?'is-former-player':''}" aria-label="${esc(p.name)} profile"><header class="v36-person-heading"><span class="v36-person-portrait" aria-hidden="true"><img src="${staffPortrait(p)}" alt=""></span><div><small>${esc(roles[role])} · ${p.formerPlayerId?'Former player':available?'Candidate':'Your staff'}</small><h3>${esc(p.name)}</h3><span class="v36-person-status">${available?'Available this month':esc(staffStatus(p))}</span>${p.formerPlayerId?`<span class="v70-legacy-tag">◆ ${esc(p.legacyLabel||'CLUB LEGACY')}</span>`:''}</div><div class="v36-quality"><strong>${p.quality}</strong><span>QUALITY / 95</span></div></header>
        <div class="v36-person-body"><section class="v36-impact"><small>${available?'WHAT THEY BRING':'STAFF CONTRIBUTION'}</small><h4>${staffImpact(role,p.quality)}</h4><p>${role==='scout'?esc((typeof p.specialism==='string'&&p.specialism.trim()?p.specialism:'GENERAL').toLowerCase())+' specialist. Assign senior reports in Transfers or youth trips in the Academy.':staffDepartments[role].description}</p>${p.formerPlayerId?`<p class="v70-legacy-note">Played for this club as a ${esc(String(p.formerPlayerRole||'player').toLowerCase())}. This is a real staff appointment with the same department limits, wages and development rules as every other hire.</p>`:''}${p.course?'<p class="v36-warning">Away on a course: this staff member does not contribute until they return.</p>':''}${available?`<p class="v36-comparison">${esc(compare)}${role!=='scout'?'. Department bonuses use the strongest available staff member; they do not stack.':''}</p>`:''}</section>
        <div class="v36-person-facts"><div><span>Weekly wage</span><strong>${cash(p.wage)}</strong></div><div><span>${available?'Signing fee':'In this department'}</span><strong>${available?cash(p.fee):own.length+' / '+limit}</strong></div></div>
        ${available?`<div class="v36-staff-decision"><p>${full?'Department full. Release a staff member before hiring.':budget<p.fee?'Not enough transfer budget for the signing fee.':(limit-own.length)+' open place'+(limit-own.length===1?'':'s')+' · '+cash(budget-p.fee)+' budget after signing'}</p>${action('hire','Hire '+esc(p.name)+' · '+cash(p.fee),disabledHire)}</div>`:`<section class="v36-development"><h4>Develop your staff</h4>${p.course?`<p>Returns ${esc(p.course.end)} · quality rises to ${Math.min(95,p.quality+p.course.gain)}.</p>`:p.quality>=95?'<p>At maximum quality.</p>':`<p>30-day course · ${p.quality} → ${Math.min(95,p.quality+3)} quality. Unavailable for work during the course.</p>${busy?'<p class="v36-warning">Finish or recall the assignment before booking a course.</p>':budget<courseCost?'<p class="v36-warning">Not enough budget for this course.</p>':''}${action('train','Book course · '+cash(courseCost),disabledTrain)}`}<details><summary>Contract & release</summary><p>Release costs ${cash(p.wage*4)} in severance (four weeks of wages).${busy||p.course?' Finish or cancel the assignment or course first.':budget<p.wage*4?' Not enough budget for severance.':''}</p>${action('fire','Review release',disabledFire,true)}</details></section>`}
        </div></article>`;
    }
    function staffHTML(){
      const c=a.club(),d=department(c),role=staffDepartments[staffFilter]?staffFilter:'scout',spec=staffDepartments[role],own=d.staff.filter(p=>p.role===role),candidates=market(c).filter(p=>p.role===role).sort((a,b)=>b.quality-a.quality),available=staffMode==='market',list=available?candidates:own;
      const selected=list.find(p=>p.key===selectedStaffKey)||list[0];selectedStaffKey=selected?.key||null;
      const weekly=d.staff.reduce((n,p)=>n+p.wage,0),limit=role==='scout'?5:2;
      return `<div class="v36-backroom"><header class="v36-backroom-heading"><div><small>${esc(c.name)} · CLUB STAFF</small><h2>Your backroom team</h2></div><div class="v36-backroom-totals"><span><b>${d.staff.length}</b> staff employed</span><span><b>${cash(weekly)}</b> weekly wages</span><span><b>${cash(a.money(c.budget))}</b> available budget</span></div></header>
      <nav class="v36-departments" aria-label="Staff departments">${Object.entries(staffDepartments).map(([key,info],i)=>{const team=d.staff.filter(p=>p.role===key),ready=team.filter(p=>!p.course&&!staffBusy(p,d)).length;return `<button type="button" data-v34-action="staff-filter" data-key="${key}" aria-pressed="${key===role}" class="${key===role?'is-selected':''}"><span class="v36-department-number">0${i+1}</span><strong>${info.name}</strong><small>${team.length} / ${key==='scout'?5:2} employed · ${ready} ready</small></button>`;}).join('')}</nav>
      <div class="v36-department-brief"><div><h3>${spec.verb}</h3><p>${spec.description}</p></div><span>${Math.max(0,limit-own.length)} open place${limit-own.length===1?'':'s'}</span></div>
      <div class="v36-staff-tabs" aria-label="Staff view"><button type="button" data-v34-action="staff-mode" data-key="team" aria-pressed="${!available}">Your staff <b>${own.length}</b></button><button type="button" data-v34-action="staff-mode" data-key="market" aria-pressed="${available}">Staff market <b>${candidates.length}</b></button></div>
      <div class="v36-staff-workspace"><section class="v36-staff-list" aria-label="${available?'Candidates':'Employed staff'}"><div class="v36-list-heading"><strong>${available?'STAFF MARKET':'YOUR STAFF'}</strong><small>${available?'New candidates each month':'Select a staff member'}</small></div>${list.map(p=>`<button type="button" class="v36-staff-pick" data-v34-action="staff-select" data-key="${esc(p.key)}" aria-pressed="${p.key===selectedStaffKey}"><span class="v36-list-portrait" aria-hidden="true"><img src="${staffPortrait(p)}" alt=""></span><span><strong>${esc(p.name)}</strong><small>${p.formerPlayerId?esc(p.legacyLabel||'FORMER PLAYER'):available?cash(p.wage)+' / week':esc(staffStatus(p))}</small></span><b>${p.quality}<small>QUALITY</small></b></button>`).join('')||`<div class="v36-staff-empty"><h4>${available?'No candidates left this month':'This department is empty'}</h4><p>${available?'Check back next month for a fresh shortlist.':'Open the staff market to find your first appointment.'}</p>${!available?button('staff-mode','Find staff','market'):''}</div>`}</section>${selected?staffCard(selected,available):`<section class="v36-staff-dossier v36-staff-empty"><h3>${available?'Recruitment desk':'Build your team'}</h3><p>${spec.description}</p></section>`}</div>
      <details class="v36-staff-help"><summary>How staff costs & development work</summary><p>Staff wages are charged in four-week instalments on the first of each month. Courses last 30 days and add up to 3 quality, capped at 95. Three monthly reviews in active service add 1 quality. Staff on courses do not contribute to department bonuses.</p></details></div>`;
    }
    function academyHTML(section='recruitment'){const c=a.club(),d=department(c),league=youthCompetition(c),available=freeScouts(c),players=a.academy(c),reports=d.reports.filter(r=>r.status==='AVAILABLE'),ownFixtures=league.fixtures.filter(f=>f.home===c.id||f.away===c.id);const recruitment=`<div class="v34-summary"><div><small>ACADEMY PLACES</small><strong>${players.length} / ${academyCap(c)}</strong></div><div><small>PROSPECT REPORTS</small><strong>${reports.length}</strong></div><div><small>ACTIVE TRIPS</small><strong>${d.missions.filter(m=>m.status==='ACTIVE').length}</strong></div></div><section class="v34-card"><h3>SEND A YOUTH SCOUT</h3><p>Choose a region and player type. Reports arrive every 30 days; each prospect stays available for 60 days. Travel costs £18k per month within your world or £30k abroad.</p><form data-v34-form="mission" class="v34-form">${select('scout','Scout',available.map(p=>option(p.key,p.name+' · '+p.quality+' quality')).join(''))}${select('region','Region',a.worlds().map(w=>option(w,w,w===c.world)).join(''))}${select('role','Player type',['ANY','ATTACKER','PLAYMAKER','DEFENDER','ALL-ROUNDER'].map(x=>option(x,x)).join(''))}${select('months','Duration',[1,3,6].map(n=>option(n,n+' month'+(n>1?'s':''))).join(''))}<button ${available.length?'':'disabled'}>DISPATCH SCOUT</button></form>${available.length?'':empty('Hire a scout or finish an active report, trip or course first.')}</section><div class="v34-grid">${d.missions.filter(m=>m.status==='ACTIVE').map(m=>`<article class="v34-card"><small>SCOUTING TRIP</small><h3>${esc(m.region)} · ${esc(m.role)}</h3><p>${esc(d.staff.find(p=>p.key===m.staffKey)?.name)} · next report ${esc(m.nextReport)} · returns ${esc(m.end)}</p>${button('recall','RECALL SCOUT',m.id)}</article>`).join('')}</div><h3 class="v34-section">RECRUITMENT REPORTS</h3><div class="v34-grid">${reports.map(r=>`<article class="v34-card"><small>${esc(r.region)} · ${esc(r.scoutName)}</small><h3>${esc(r.player.name)}</h3><p>${r.player.age} · ${esc(r.player.role)} · ${esc(r.player.country)}</p><div class="v34-facts"><span>Estimated ability <b>${r.ovrLow}–${r.ovrHigh}</b></span><span>Potential range <b>${r.potentialLow}–${r.potentialHigh}</b></span></div><p>Report expires ${esc(r.expires)}</p><div class="v34-actions">${button('sign-youth','SIGN · '+cash(r.fee),r.id)}${button('decline-youth','DECLINE',r.id)}</div></article>`).join('')||empty('Dispatch a scout to receive targeted prospect reports.')}</div>`;const competition=`<h3 class="v34-section">ACADEMY LEAGUE · ${esc(league.season)}</h3><p>Eight clubs, home and away. Fixtures run automatically on their scheduled dates. Select your starting three; missing selections are filled from eligible academy players. Fewer than three eligible players means a walkover. Academy statistics remain separate from senior records.</p><section class="v34-card"><form data-v34-form="youth-team"><div class="v34-youth-picks">${players.map(p=>`<label><input type="checkbox" name="players" value="${esc(p.id)}" ${league.selection.includes(p.id)?'checked':''} ${p.injured||p.age>21?'disabled':''}><span><b>${esc(p.name)}</b><small>${esc(p.role)} · ${p.ovr} OVR · ${p.academyStats?.apps||0} academy appearances</small></span></label>`).join('')}</div><div class="v34-form">${select('plan','Match priority',[['BALANCED','Balanced'],['DEVELOPMENT','Development · more growth from appearances'],['COMPETE','Compete · stronger match preparation']].map(([v,l])=>option(v,l,v===league.plan)).join(''))}<button>SAVE ACADEMY TEAM</button></div></form></section><div class="v34-columns"><section class="v34-card"><h3>LEAGUE TABLE</h3><div class="v34-table-wrap"><table><thead><tr><th>Club</th><th>P</th><th>GD</th><th>PTS</th></tr></thead><tbody>${youthTable(league).map((r,i)=>`<tr class="${r.id===c.id?'is-own':''}"><td>${i+1}. ${esc(a.clubById(r.id)?.name)}</td><td>${r.played}</td><td>${r.gf-r.ga}</td><td>${r.points}</td></tr>`).join('')}</tbody></table></div></section><section class="v34-card"><h3>YOUR ACADEMY FIXTURES</h3>${ownFixtures.map(f=>`<div class="v34-fixture"><small>${f.date}</small><span>${esc(a.clubById(f.home)?.name)} <b>${f.played?f.hs+'–'+f.as:'v'}</b> ${esc(a.clubById(f.away)?.name)}</span>${f.forfeit?'<small>Walkover</small>':''}</div>`).join('')}</section></div>`;const lead=personnelBrief(d,'academy','ACADEMY LEAD',section==='league'?'The academy director sets the match plan and tracks which prospects are earning a genuine senior pathway.':'The academy director connects youth scouting, development reports and promotion decisions.');return lead+(section==='league'?competition:recruitment);}
    function facilitiesHTML(section='facilities'){const c=a.club(),d=department(c),s=d.sponsor,notes={training:'Each level above 1 adds 4% to senior development progress.',academy:'Each level adds two academy places and improves youth development.',medical:'Level 3 adds daily recovery support, alongside medical staff.',stadium:'Adds seating capacity and raises receipts from home matches.'};const investment=`<div class="v34-summary"><div><small>STADIUM CAPACITY</small><strong>${d.capacity.toLocaleString()}</strong></div><div><small>PROJECTS IN PROGRESS</small><strong>${d.projects.filter(p=>p.status==='BUILDING').length}</strong></div><div><small>UNPAID OPERATING COSTS</small><strong>${cash(d.arrears)}</strong></div></div><div class="v34-grid">${Object.entries(facilities).map(([type,spec])=>{const q=quoteUpgrade(type,c),project=d.projects.find(p=>p.type===type&&p.status==='BUILDING');return `<article class="v34-card v44-facility-card">${typeof a.facilityVisual==='function'?a.facilityVisual(c,type,q.level,project):''}<small>LEVEL ${q.level} / 5</small><h3>${spec.name}</h3><p>${notes[type]}</p><p>Upkeep: ${cash(q.level*1500)} per month.</p>${project?`<p class="v34-highlight">Construction completes ${project.end}</p>`:q.level>=5?'<p>Fully upgraded</p>':`<p>${q.days} days${q.capacityGain?' · '+q.capacityGain.toLocaleString()+' extra seats':''}</p>${button('upgrade','APPROVE · '+cash(q.cost),type)}`}</article>`;}).join('')}</div>`;const commercial=`<h3 class="v34-section">COMMERCIAL PARTNERSHIPS</h3>${s?.status==='ACTIVE'?`<section class="v34-card"><small>EXCLUSIVE PARTNER · UNTIL ${s.end}</small><h3>${esc(s.name)}</h3><div class="v34-facts"><span>Monthly payment <b>${cash(s.monthly)}</b></span><span>Earned to date <b>${cash(s.earned)}</b></span><span>Win target <b>${s.target?s.target+' wins / month':'No performance condition'}</b></span></div><p>${s.target?'Earn an extra '+cash(s.bonus)+' when the previous month meets the win target.':'Guaranteed monthly payments.'}</p></section>`:`<div class="v34-grid">${sponsorOffers(c).map(o=>`<article class="v34-card"><h3>${esc(o.name)}</h3><p>One-year exclusive contract</p><div class="v34-facts"><span>On signing <b>${cash(o.upfront)}</b></span><span>Monthly <b>${cash(o.monthly)}</b></span></div><p>${o.target?o.target+' wins in a calendar month earns '+cash(o.bonus)+' extra.':'Guaranteed payment with no win target.'}</p>${button('sponsor','SIGN PARTNER',o.id)}</article>`).join('')}</div>`}`;const ledger=`<h3 class="v34-section">CLUB OPERATING LEDGER</h3><div class="v34-table-wrap"><table><thead><tr><th>Date</th><th>Transaction</th><th>Amount</th><th>Balance</th></tr></thead><tbody>${d.ledger.slice(0,40).map(x=>`<tr><td>${x.date}</td><td>${esc(x.label)}</td><td class="${x.amount<0?'is-debit':'is-credit'}">${x.amount<0?'−':'+'}${cash(Math.abs(x.amount))}</td><td>${cash(x.balance)}</td></tr>`).join('')||'<tr><td colspan="4">Staff, scouting, construction and commercial transactions appear here.</td></tr>'}</tbody></table></div>`;return section==='commercial'?personnelBrief(d,'commercial','COMMERCIAL LEAD','The commercial director turns club momentum into partnership value and explains the trade-off behind each offer.')+commercial:section==='ledger'?ledger:investment;}
    function structuredTermsText(t={}){const plan=transferCashPlan(t),payments=plan.count===1?'paid upfront':plan.count+' guaranteed payments',addOn=t.addOnType==='APPEARANCES'?' · '+cash(t.addOnAmount)+' after 15 appearances':t.addOnType==='TEAM_WINS'?' · '+cash(t.addOnAmount)+' after 10 league wins':'';return payments+addOn;}
    function transferCommitmentsHTML(club){
      const f=transferFinanceState(),payments=f.payments.filter(x=>x.buyerId===club?.id&&['SCHEDULED','OVERDUE'].includes(x.status)),addOns=f.addOns.filter(x=>x.buyerId===club?.id&&['ACTIVE','TRIGGERED','OVERDUE'].includes(x.status));if(!payments.length&&!addOns.length)return'';
      return`<h3 class="v34-section">TRANSFER COMMITMENTS</h3><div class="v35-transfer-commitments">${payments.map(x=>`<article><small>${x.status==='OVERDUE'?'OVERDUE':'GUARANTEED INSTALMENT'} · ${x.due}</small><strong>${esc(x.playerName)}</strong><span>${cash(x.amount)} due to ${esc(a.clubById(x.sellerId)?.name||'selling club')}</span></article>`).join('')}${addOns.map(x=>`<article><small>${x.status==='OVERDUE'?'PAYMENT OVERDUE':'CONDITIONAL ADD-ON'}</small><strong>${esc(x.playerName)}</strong><span>${cash(x.amount)} · ${x.type==='APPEARANCES'?x.progress+' / '+x.target+' appearances':x.progress+' / '+x.target+' league wins'}</span></article>`).join('')}</div>`;
    }
    function agreementsHTML(section){
      const c=a.club(),future=state().precontracts.filter(x=>x.buyerId===c.id&&x.status==='SIGNED'),loans=a.loans().filter(l=>l.status==='ACTIVE'&&l.buyOption?.buyerId===c.id),offers=(state().offers||[]).filter(o=>o.buyerId===c.id&&(view!=='deals'||o.playerId===selectedTarget)&&o.status==='AGREED'&&o.expires>=a.date());
      if(section==='future')return`<h3 class="v34-section">FUTURE ARRIVALS</h3>${future.map(o=>`<article class="v34-card"><small>${o.kind==='TRANSFER'?'TRANSFER AGREED':'PRE-CONTRACT'}</small><h3>${esc(o.playerName)}</h3>${o.kind==='TRANSFER'?`<p>${cash(o.escrow)} set aside for the guaranteed fee and signing bonus · ${esc(structuredTermsText(o.terms))}.</p>`:''}<p>Joins ${o.joinDate} · ${cash(o.terms.wage)} / week reserved · one senior place reserved.</p></article>`).join('')||empty('No future signings agreed. Complete a transfer outside the window to reserve an arrival here.')}`;
      if(section==='loans')return`<h3 class="v34-section">LOAN BUY OPTIONS</h3>${loans.map(l=>`<article class="v34-card"><h3>${esc(a.player(l.playerId)?.name)}</h3><p>Option ${cash(l.buyOption.fee)} · expires ${l.endDate} · signing bonus ${cash(l.buyOption.terms.bonus)}</p>${button('buy-option','EXERCISE OPTION',l.id)}</article>`).join('')||empty('No active buy options.')}`;
      return`<h3 class="v34-section">AGREED PACKAGES</h3><div class="v34-grid">${offers.map(o=>`<article class="v34-card"><small>${esc(o.kind.replace('_',' '))} · EXPIRES ${o.expires}</small><h3>${esc(a.player(o.playerId)?.name)}</h3><p>Guaranteed fee ${cash(o.terms.fee)} · ${esc(structuredTermsText(o.terms))}</p><p>Bonus ${cash(o.terms.bonus)} · wage ${cash(o.terms.wage)} / week · ${o.terms.years} years · ${esc(o.terms.role)}</p><p>Sell-on ${o.terms.sellOn}%${o.terms.releaseClause?' · release clause '+cash(o.terms.releaseClause):' · no release clause'}${o.terms.swapId?' · exchange '+esc(a.player(o.terms.swapId)?.name):''}${o.kind==='LOAN_BUY'?' · option '+cash(o.terms.optionFee)+' · wage share '+o.terms.wageShare+'%':''}</p>${!a.windowOpen()&&['TRANSFER','RELEASE'].includes(o.kind)?`<p>Joins ${a.nextWindow()}. Guaranteed funds and the bonus are set aside now; salary starts on arrival.</p>`:''}${button('confirm-deal','REVIEW & COMPLETE',o.id)}</article>`).join('')||empty('Accepted negotiations appear here before you commit.')}</div>${transferCommitmentsHTML(c)}`;
    }
    function dealsHTML(){
      const found=target(selectedTarget),p=found?.p;if(!p)return empty('This player is no longer available. Return to Transfers to select a player.');
      const kinds=[['TRANSFER','Transfer with sell-on'],...(p.releaseClause?[['RELEASE','Activate release clause · '+a.format(p.releaseClause)]]:[]),['SWAP','Player exchange + cash'],['PRECONTRACT','Pre-contract'],['LOAN_BUY','Loan with buy option']];
      if(!kinds.some(([key])=>key===dealKind))dealKind='TRANSFER';
      const kind=dealKind,loan=kind==='LOAN_BUY',pre=kind==='PRECONTRACT',release=kind==='RELEASE',value=a.value(p);
      return `<div class="v35-deal-heading"><small>${esc(found.owner?.name||'FREE AGENT')} · ${p.age} · ${esc(p.role)}</small><h3>${esc(p.name)}</h3><p>${p.releaseClause?'Existing release clause: '+cash(p.releaseClause)+' · ':''}Contract ends ${esc(p.contractEndDate||'unattached')}</p></div>${!a.windowOpen()&&['TRANSFER','RELEASE'].includes(kind)?`<p class="v40-arrival-note">Agree now · joins ${a.nextWindow()}. The player stays at their current club until then.</p>`:''}<form data-v34-form="deal" class="v34-form"><input type="hidden" name="playerId" value="${esc(p.id)}"><input type="hidden" name="kind" value="${kind}">
      ${release?`<input type="hidden" name="fee" value="${p.releaseClause}"><p class="v35-term-note">Pay ${cash(p.releaseClause)} to bypass the selling club’s fee negotiations. The player must still agree personal terms.</p>`:pre?'<input type="hidden" name="fee" value="0"><p class="v35-term-note">Available to players aged 23+ with six months or less remaining. Joins after the existing contract expires.</p>':field('fee',loan?'Loan fee':'Cash offer',loan?Math.round(value*.05):value)}
      ${kind==='SWAP'?select('swapId','Player offered in exchange',option('','Choose a player')+a.squad(a.club()).filter(x=>!x.captain&&!x.onLoan&&!x.v34Precontract).map(x=>option(x.id,x.name+' · '+a.format(a.value(x)))).join('')):''}
      ${!loan&&!release&&!pre?`<div class="v35-form-section">GUARANTEED FEE STRUCTURE</div>${select('installments','Payment schedule',[[1,'100% upfront'],[2,'70% now · 30% in six months'],[3,'55% now · two later instalments']].map(([n,label])=>option(n,label,n===1)).join(''))}<div class="v35-form-section">CONDITIONAL ADD-ON</div>${select('addOnType','Trigger',[['NONE','No conditional add-on'],['APPEARANCES','Pay after 15 appearances'],['TEAM_WINS','Pay after 10 league wins']].map(([key,label])=>option(key,label,key==='NONE')).join(''))}${field('addOnAmount','Conditional amount',0)}`:''}
      ${loan?field('optionFee','Optional permanent fee',value)+field('wageShare','Loan wage contribution (%)',100,'number','min="0" max="100"'):''}
      <div class="v35-form-section">${loan?'PERSONAL TERMS IF THE OPTION IS EXERCISED':'PERSONAL TERMS'}</div>
      ${field('wage','Weekly wage',a.expectedWage(p))}${field('bonus',loan?'Bonus on permanent signing':'Signing bonus',0)}${select('years','Contract length',[1,2,3,4,5].map(n=>option(n,n+' years',n===3)).join(''))}${select('role','Squad role',['Crucial','Important','Rotation','Prospect','Reserve'].map(r=>option(r,r,r==='Rotation')).join(''))}
      ${!release&&!pre?field('sellOn','Seller’s share of next transfer (%)',0,'number','min="0" max="30"'):''}
      <label class="v34-check v35-form-section"><input type="checkbox" data-v35-clause-toggle>Add a release clause to the new contract (optional)</label><label hidden>Release clause amount<input name="releaseClause" value="0" disabled inputmode="decimal" placeholder="e.g. 1.5m"></label>
      <button>PROPOSE TERMS</button></form><p class="v35-term-note">${loan?'The loan fee is paid now; the buy option is voluntary. The permanent fee and bonus are only due when exercised.':release||pre?'A new contract has no release clause unless you choose to negotiate one.':'Deferred guaranteed money is valued slightly below cash now. Conditional add-ons pay automatically when their real career milestone is reached.'}</p>${agreementsHTML('active')}`;
    }
    function salesHTML(offerId){const c=a.club(),offers=a.sales().filter(o=>(!offerId||o.id===offerId)&&o.sellerClubId===c.id&&['OPEN','COUNTERED','FINAL_OFFER'].includes(o.status));return `<h3 class="v34-section">SELL WITH A FUTURE SHARE</h3><p>Trade part of an incoming cash offer for a share of the player’s next transfer. Each 10% retained reduces today’s fee by 5%. Review the exact adjusted fee before accepting.</p><div class="v34-grid">${offers.map(o=>`<article class="v34-card"><h3>${esc(a.player(o.playerId)?.name)}</h3><p>${esc(a.clubById(o.buyerClubId)?.name)} · cash offer ${cash(o.currentFee||o.offer||o.amount||o.currentOffer||o.fee||0)}</p><form class="v34-form" data-v34-form="sell-deal"><input type="hidden" name="offerId" value="${esc(o.id)}">${select('percent','Future transfer share',[0,10,20,30].map(n=>option(n,n+'%')).join(''))}<button>GET ADJUSTED QUOTE</button></form></article>`).join('')||empty('Incoming transfer offers appear here when other clubs bid for your players.')}</div>${(state().saleQuotes||[]).filter(q=>(!offerId||q.offerId===offerId)&&q.sellerId===c.id&&q.status==='QUOTED'&&q.expires>=a.date()).map(q=>`<article class="v34-card"><h3>${esc(q.playerName)}</h3><p>${cash(q.fee)} now · ${q.percent}% of the next transfer</p>${button('confirm-sale','REVIEW SALE',q.id)}</article>`).join('')}`;}
    function createHTML(){return `<section class="v34-card"><h3>BUILD YOUR CLUB’S IDENTITY</h3><p>Your club takes the league place, initial squad and home-ground artwork of the club you replace. Its name, crest, colours, stadium name and chosen budget belong to this career only.</p><form class="v34-form" data-v34-form="create">${field('name','Club name','','text','required minlength="3" maxlength="32"')}${field('abbr','Short code','','text','required pattern="[A-Za-z0-9]{2,4}" maxlength="4"')}${field('stadium','Stadium name','','text','required minlength="3" maxlength="40"')}${select('replaceId','Replace a club',a.clubs().map(c=>option(c.id,c.world+' · '+c.division+' · '+c.name)).join(''))}<div class="v34-badge-maker"><div class="v34-badge-preview"><img id="v34BadgePreview" alt="Crest preview"></div><div class="v34-badge-fields">${select('badge','Crest shape',[['shield','Shield'],['round','Roundel'],['diamond','Diamond'],['hexagon','Hexagon'],['pentagon','Pentagon']].map(([v,l])=>option(v,l)).join(''))}${select('pattern','Pattern',[['solid','Solid'],['halves','Halves'],['hoops','Hoops'],['sash','Sash'],['chevron','Chevron'],['quarters','Quarters'],['ring','Ring'],['stripes','Stripes']].map(([v,l])=>option(v,l)).join(''))}${select('icon','Emblem',[['none','None · initials only'],['star','Star'],['ring','Ring'],['cross','Cross'],['bolt','Bolt'],['wave','Wave'],['crown','Crown'],['flame','Flame'],['leaf','Leaf'],['paw','Paw']].map(([v,l])=>option(v,l)).join(''))}${field('primary','Primary colour','#14b8a6','color')}${field('secondary','Secondary colour','#10243b','color')}</div></div>${select('budget','Starting budget',[['community','Community · £500k'],['standard','Established · £2m'],['ambitious','Ambitious · £5m']].map(([v,l])=>option(v,l,v==='standard')).join(''))}<button>CREATE CLUB & BEGIN CAREER</button></form></section>`;}
    function savesHTML(){const store=a.store();return `<details class="v35-import"><summary>IMPORT A CAREER BACKUP</summary><p>Choose a slot to replace. Your other careers stay separate.</p><form data-v34-form="import" class="v34-form">${select('slot','Destination slot',[1,2,3].map(n=>option(n,'Slot '+n)).join(''))}<label>Backup file<input type="file" name="save" accept=".velmora,.json,.txt" required></label><label class="v34-check"><input type="checkbox" name="confirm" value="yes" required>Replace this slot with the uploaded backup.</label><button>IMPORT BACKUP</button></form></details>${store?.status().error?`<p class="v34-feedback">${esc(store.status().error)}. Export your active slot to keep the latest unsaved progress.</p>`:''}`;}
    function slotActions(slot,hasSave){return `${hasSave?button('export','EXPORT BACKUP',slot):''}${a.store()?.hasBackup(slot)?button('recover','RESTORE PREVIOUS SAVE',slot,true):''}`;}
    async function exportSave(slot){const store=a.store();try{await store?.flush();}catch(_){}const raw=store?.exportSlot(slot)||a.saveRaw(slot);if(!raw)throw new Error('This slot is empty.');const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'})),link=document.createElement('a');link.href=url;link.download='Velmora-career-slot-'+slot+'-'+a.date()+'.velmora';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    async function recover(slot){if(!a.store())return fail('Recovery storage is not available in this browser.');await a.store().recover(slot);a.reloadSlot?.(slot);return success('Previous save restored. Use Continue Career to load it.');}
    function initUI(){document.addEventListener('click',event=>{const b=event.target.closest?.('[data-v34-open]');if(b){event.preventDefault();open(b.dataset.v34Open,b.dataset.player||null);}});}
    return {state,department,market,addLegacyCandidate,hire,fire,trainStaff,scouts,freeScouts,personnelForRole,sendScout,cancelMission,signProspect,declineProspect,academyCap,youthCompetition,youthTable,setYouthTeam,quoteUpgrade,upgrade,sponsorOffers,signSponsor,developmentFactor,recoveryBonus,daily,staffQuality,
      reservedPlaces,reservedWages,reservedTransferPayments,transferCashPlan,structuredOfferCredit,processTransferPayments,scheduleTransfer,proposeDeal,confirmDeal,exerciseOption,processPrecontracts,negotiateClause,onTransfer,restoreCustom,createClub,quoteSale,confirmSale,
      open,close,initUI,render,embed,bindHost,slotActions,seedClauses,validateClause,setClause,staffHTML,academyHTML,facilitiesHTML,dealsHTML,createHTML,savesHTML};
  }
  root.VelmoraCareerExpansion={create};
  if(typeof module==='object'&&module.exports)module.exports={create};
})(typeof window==='object'?window:globalThis);
