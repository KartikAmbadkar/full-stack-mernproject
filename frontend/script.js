/* IMovies - cinema booking logic (browse, seat map, checkout, bookings, admin) */
(function(){
'use strict';
var THEATRES=[
  {name:'IMovies Central',info:'Screen 2 · Dolby Atmos'},
  {name:'IMovies Riverside',info:'Screen 1 · 4K laser'},
  {name:'IMovies Skyline',info:'Screen 4 · Large format'}
];
var TIMES=['10:15 AM','1:30 PM','4:45 PM','7:30 PM','10:30 PM'];
var ROWS='ABCDEFGHIJ'.split(''), COLS=12, FEE=20, MAXSEATS=8;
var COLORS=[['#1d4e5f','#e07a3f'],['#3b2a5c','#d6566f'],['#0f3a4a','#3fb6c4'],['#5a2d1c','#e9b44c'],['#23402f','#9ccf6e'],['#2a2f6b','#7aa2ff'],['#4a1f35','#f08c6a'],['#1d3b3a','#e8d27a']];
var movies=[
  {id:1,title:'Monsoon Express',genre:'Thriller',lang:'Hindi',dur:'2h 14m',cert:'U/A',score:8.1,c:0,desc:'A night train, a stolen ledger and eleven strangers who each need it to reach Mumbai alive.'},
  {id:2,title:'The Last Reel',genre:'Drama',lang:'English',dur:'1h 58m',cert:'U',score:7.8,c:1,desc:'A projectionist in a closing single-screen cinema screens one final film for the town that grew up in the dark.'},
  {id:3,title:'Neon Harbour',genre:'Sci-Fi',lang:'English',dur:'2h 31m',cert:'U/A',score:8.4,c:2,desc:'In a port city that runs on light, a dock inspector finds a ship that has not yet arrived.'},
  {id:4,title:'Paper Lanterns',genre:'Romance',lang:'Tamil',dur:'2h 05m',cert:'U',score:7.5,c:3,desc:'Two lantern makers from rival streets share one festival week and one very small workshop.'},
  {id:5,title:'Dust & Diesel',genre:'Action',lang:'Hindi',dur:'2h 22m',cert:'U/A',score:7.2,c:4,desc:'A highway convoy, a broken-down tanker and four hours before the toll gate closes.'},
  {id:6,title:'Orbit Nine',genre:'Sci-Fi',lang:'Telugu',dur:'2h 40m',cert:'U/A',score:8.0,c:5,desc:'The ninth crew to reach the relay station is the first to find someone already home.'},
  {id:7,title:'Grandma’s Cricket Club',genre:'Comedy',lang:'Hindi',dur:'1h 49m',cert:'U',score:7.9,c:6,desc:'Six grandmothers, one dusty ground and a league that never expected them to win a match.'},
  {id:8,title:'Salt Road',genre:'Drama',lang:'Malayalam',dur:'2h 08m',cert:'U/A',score:8.2,c:7,desc:'A salt trader walks the coast road home and settles every debt he has left behind.'}
];

/* helpers */
function $(s,r){return (r||document).querySelector(s)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(n){return '₹'+Number(n).toLocaleString('en-IN')}
var mem={};
function load(k,d){try{var v=localStorage.getItem(k);if(v!==null)return JSON.parse(v)}catch(e){}return mem[k]!==undefined?mem[k]:d}
function save(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function hash(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){var a=seed;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function dkey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fromKey(k){var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function longDay(k){var d=fromKey(k);return WD[d.getDay()]+' '+d.getDate()+' '+MO[d.getMonth()]}
var DAYS=[0,1,2,3,4].map(function(i){var d=new Date();d.setDate(d.getDate()+i);return dkey(d)});
function toMin(t){var p=t.split(' '),hm=p[0].split(':').map(Number),h=hm[0];if(p[1]==='PM'&&h!==12)h+=12;if(p[1]==='AM'&&h===12)h=0;return h*60+hm[1]}
function isPast(sh){var today=dkey(new Date());if(sh.date<today)return true;if(sh.date===today){var n=new Date();return toMin(sh.time)<=n.getHours()*60+n.getMinutes()+10}return false}
function movie(id){return movies.find(function(m){return m.id===id})}
function toast(msg,kind){var t=document.createElement('div');t.className='toast'+(kind==='bad'?' bad':'');t.textContent=msg;$('#toasts').appendChild(t);setTimeout(function(){t.remove()},3400)}

/* shows + seats */
function showsOf(m,dk){
  var r=rng(hash(m.id+'|'+dk)),groups=[];
  THEATRES.forEach(function(t,ti){
    if((m.id+ti)%3===2)return;
    var times=TIMES.filter(function(){return r()>0.42});
    if(!times.length)times=[TIMES[3]];
    groups.push({ti:ti,shows:times.map(function(tm){return {id:m.id+'|'+dk+'|'+ti+'|'+tm,movie:m.id,date:dk,ti:ti,time:tm}})});
  });
  return groups;
}
function showById(id){var p=id.split('|');return {id:id,movie:+p[0],date:p[1],ti:+p[2],time:p[3]}}
function tierOf(row){var i=ROWS.indexOf(row);return i<3?{name:'Silver',price:180}:i<7?{name:'Gold',price:260}:{name:'Premium',price:380}}
var baseCache={}, live={};
function baseBooked(id){if(baseCache[id])return baseCache[id];var r=rng(hash(id)),s=new Set();ROWS.forEach(function(rw){for(var n=1;n<=COLS;n++){if(r()<0.28)s.add(rw+n)}});baseCache[id]=s;return s}
function bookings(){return load('imv_bookings',[])}
function bookedSet(id){var s=new Set(baseBooked(id));(live[id]||[]).forEach(function(x){s.add(x)});bookings().forEach(function(b){if(b.status==='confirmed'&&b.showId===id)b.seats.forEach(function(x){s.add(x)})});return s}

/* state */
var S={view:'browse',q:'',genre:'All',lang:'All',theatre:'All',date:DAYS[0],limit:12,
  movieId:null,bdate:DAYS[0],show:null,sel:new Set(),method:'upi',paying:false,
  user:load('imv_user',null),tab:'upcoming',confirmCancel:null,last:null};

if(load('imv_bookings',null)===null){
  var up=DAYS[1];
  save('imv_bookings',[
    {id:'IMSAMP1',showId:'1|'+up+'|1|7:30 PM',movieId:1,theatre:1,date:up,time:'7:30 PM',seats:['F5','F6'],total:2*260+2*FEE,method:'upi',status:'confirmed',sample:true},
    {id:'IMSAMP2',showId:'2|'+dkey(new Date(Date.now()-2*864e5))+'|0|4:45 PM',movieId:2,theatre:0,date:dkey(new Date(Date.now()-2*864e5)),time:'4:45 PM',seats:['C3'],total:180+FEE,method:'card',status:'confirmed',sample:true}
  ]);
}

/* views */
function poster(m,small){
  var c=COLORS[m.c%COLORS.length];
  return '<div class="poster" style="--a:'+c[0]+';--b:'+c[1]+'" role="img" aria-label="Poster for '+esc(m.title)+'"><i>'+esc(m.genre)+' · '+esc(m.lang)+'</i><b>'+esc(m.title)+'</b></div>';
}
function dayStrip(sel,act){
  return '<div class="days" role="group" aria-label="Choose a date">'+DAYS.map(function(k,i){var d=fromKey(k);
    return '<button class="chip" data-act="'+act+'" data-v="'+k+'" aria-pressed="'+(k===sel)+'"><small>'+(i===0?'Today':WD[d.getDay()])+'</small>'+d.getDate()+' '+MO[d.getMonth()]+'</button>'}).join('')+'</div>';
}
function opts(list,cur){return list.map(function(x){return '<option'+(x===cur?' selected':'')+'>'+esc(x)+'</option>'}).join('')}
function renderBrowse(){
  var genres=['All'].concat(Array.from(new Set(movies.map(function(m){return m.genre}))).sort());
  var langs=['All'].concat(Array.from(new Set(movies.map(function(m){return m.lang}))).sort());
  $('#main').innerHTML=
   '<div class="head"><span class="eyebrow">Showtimes for '+longDay(S.date)+'</span><h1>Now showing</h1><p class="muted">Pick a film, choose a screen and time, then pick your own seats. Availability updates while you look.</p></div>'+
   '<div class="filters"><input class="field search" id="q" type="search" placeholder="Search by film title" value="'+esc(S.q)+'" aria-label="Search films">'+
   '<select class="field" id="fg" aria-label="Genre">'+opts(genres,S.genre)+'</select>'+
   '<select class="field" id="fl" aria-label="Language">'+opts(langs,S.lang)+'</select>'+
   '<select class="field" id="ft" aria-label="Theatre">'+opts(['All'].concat(THEATRES.map(function(t){return t.name})),S.theatre)+'</select></div>'+
   dayStrip(S.date,'date')+'<div id="results"></div>';
  renderResults();
}
function nextShow(m,dk){
  var best=null;
  showsOf(m,dk).forEach(function(g){if(S.theatre!=='All'&&THEATRES[g.ti].name!==S.theatre)return;g.shows.forEach(function(sh){if(isPast(sh))return;if(!best||toMin(sh.time)<toMin(best.time))best=sh})});
  return best;
}
function renderResults(){
  var q=S.q.trim().toLowerCase();
  var list=movies.filter(function(m){
    return (!q||m.title.toLowerCase().indexOf(q)>-1)&&(S.genre==='All'||m.genre===S.genre)&&(S.lang==='All'||m.lang===S.lang)&&nextShow(m,S.date)
  });
  var box=$('#results');
  if(!list.length){box.innerHTML='<div class="empty">No films match these filters for '+longDay(S.date)+'. Try another day, theatre or language.</div>';return}
  var shown=list.slice(0,S.limit);
  box.innerHTML='<div class="grid-movies">'+shown.map(function(m){
    var n=nextShow(m,S.date);
    return '<article class="card"><button class="pbtn" data-act="open" data-id="'+m.id+'" aria-label="Book '+esc(m.title)+'">'+poster(m)+'</button>'+
     '<div><h3>'+esc(m.title)+'</h3><div class="meta"><span>'+esc(m.genre)+' · '+esc(m.lang)+'</span><span>'+m.dur+'</span><span class="score">★ '+m.score.toFixed(1)+'</span></div></div>'+
     '<div class="next muted">Next: <span class="mono">'+n.time+'</span> · '+THEATRES[n.ti].name.replace('IMovies ','')+'</div>'+
     '<button class="btn sm" data-act="open" data-id="'+m.id+'">Book tickets</button></article>'}).join('')+'</div>'+
     (list.length>shown.length?'<p style="text-align:center;margin-top:24px"><button class="btn ghost" data-act="more">Show more films</button></p>':'');
}

function openMovie(id){
  S.movieId=id;S.bdate=S.date;S.sel=new Set();S.paying=false;
  pickDefaultShow();go('book');
}
function pickDefaultShow(){
  var m=movie(S.movieId);S.show=null;
  var gs=showsOf(m,S.bdate);
  for(var i=0;i<gs.length&&!S.show;i++){for(var j=0;j<gs[i].shows.length;j++){if(!isPast(gs[i].shows[j])){S.show=gs[i].shows[j];break}}}
}
function renderBook(){
  var m=movie(S.movieId);
  var gs=showsOf(m,S.bdate);
  $('#main').innerHTML=
   '<button class="btn ghost sm back" data-act="back">← All films</button>'+
   '<div class="book"><div>'+
   '<div class="film">'+poster(m)+'<div><span class="eyebrow">'+esc(m.genre)+' · '+esc(m.lang)+'</span><h2 style="margin-top:8px">'+esc(m.title)+'</h2>'+
   '<div class="meta" style="margin-top:8px"><span class="pill">'+m.cert+'</span><span class="pill">'+m.dur+'</span><span class="pill">★ '+m.score.toFixed(1)+'</span></div><p class="muted">'+esc(m.desc)+'</p></div></div>'+
   '<div class="sec" style="margin-top:0"><h3>Choose a show</h3>'+dayStrip(S.bdate,'bdate')+
   gs.map(function(g){var t=THEATRES[g.ti];
     return '<div class="theatre"><div><div class="tname">'+t.name+'</div><div class="note">'+t.info+'</div></div><div class="times">'+
      g.shows.map(function(sh){var past=isPast(sh);
        return '<button class="chip time" data-act="show" data-id="'+sh.id+'" aria-pressed="'+(!!S.show&&S.show.id===sh.id)+'"'+(past?' disabled':'')+'>'+sh.time+'</button>'}).join('')+'</div></div>'}).join('')+
   '</div>'+
   '<div class="sec"><div class="seathead"><h3>Pick your seats</h3><span class="live" id="liveinfo"></span></div><div class="seatbox" id="seatwrap"></div></div>'+
   '</div><aside id="summary" class="summary" aria-label="Booking summary"></aside></div>';
  updateSeats();
}
function seatsHTML(){
  if(!S.show)return '<p class="muted" style="text-align:center;margin:20px 0">No upcoming shows on '+longDay(S.bdate)+'. Pick another day above.</p>';
  var bk=bookedSet(S.show.id),last='';
  var h='<div class="screen"><span>Screen this way</span></div><div class="seats" role="group" aria-label="Seat map">';
  ROWS.forEach(function(r){
    var t=tierOf(r);
    if(t.name!==last){h+='<div class="tier">'+t.name+' · '+money(t.price)+'</div>';last=t.name}
    h+='<div class="rl">'+r+'</div>';
    for(var n=1;n<=COLS;n++){
      if(n===7)h+='<span class="aisle"></span>';
      var id=r+n,b=bk.has(id),s=S.sel.has(id);
      h+='<button class="seat'+(b?' taken':'')+(s?' on':'')+'" data-act="seat" data-v="'+id+'"'+(b?' disabled':'')+' aria-pressed="'+s+'" aria-label="Seat '+id+', '+t.name+', '+money(t.price)+(b?', taken':'')+'">'+n+'</button>';
    }
  });
  h+='</div><div class="legend"><span><button class="seat" tabindex="-1" aria-hidden="true"></button>Available</span><span><button class="seat on" tabindex="-1" aria-hidden="true"></button>Selected</span><span><button class="seat taken" tabindex="-1" aria-hidden="true"></button>Taken</span></div>';
  return h;
}
function summaryHTML(){
  var m=movie(S.movieId),sh=S.show;
  if(!sh)return '<h3>Your booking</h3><p class="muted">Select a show to start.</p>';
  var seats=Array.from(S.sel).sort(function(a,b){return ROWS.indexOf(a[0])-ROWS.indexOf(b[0])||parseInt(a.slice(1))-parseInt(b.slice(1))});
  var by={};seats.forEach(function(s){var t=tierOf(s[0]);by[t.name]=by[t.name]||{n:0,p:t.price};by[t.name].n++});
  var sub=seats.reduce(function(a,s){return a+tierOf(s[0]).price},0),fee=seats.length*FEE,total=sub+fee;
  return '<h3>Your booking</h3>'+
   '<div><b>'+esc(m.title)+'</b><div class="note">'+THEATRES[sh.ti].name+' · '+longDay(sh.date)+' · <span class="mono">'+sh.time+'</span></div></div>'+
   (seats.length?'<div class="seatchips">'+seats.map(function(s){return '<span>'+s+'</span>'}).join('')+'</div>'+
     Object.keys(by).map(function(k){return '<div class="row"><span>'+by[k].n+' × '+k+'</span><span class="mono">'+money(by[k].n*by[k].p)+'</span></div>'}).join('')+
     '<div class="row muted"><span>Booking fee</span><span class="mono">'+money(fee)+'</span></div><div class="row total"><span>Total</span><span class="mono">'+money(total)+'</span></div>'
    :'<p class="muted" style="margin:0">Tap seats on the map. You can book up to '+MAXSEATS+'.</p>')+
   '<div class="pm" role="radiogroup" aria-label="Payment method">'+[['upi','UPI'],['card','Debit / credit card'],['net','Net banking']].map(function(p){return '<label><input type="radio" name="pm" value="'+p[0]+'"'+(S.method===p[0]?' checked':'')+'>'+p[1]+'</label>'}).join('')+'</div>'+
   '<button class="btn" data-act="pay"'+(!seats.length||S.paying?' disabled':'')+'>'+(S.paying?'Processing payment…':(seats.length?'Pay '+money(total):'Select seats to pay'))+'</button>'+
   '<p class="note" style="margin:0">Test checkout. No real payment is taken.</p>';
}
function updateSeats(){
  var w=$('#seatwrap');if(!w)return;
  w.innerHTML=seatsHTML();
  var li=$('#liveinfo');
  if(li){if(S.show){var left=ROWS.length*COLS-bookedSet(S.show.id).size;li.textContent=left+' seats left · live'}else li.textContent=''}
  updateSummary();
}
function updateSummary(){var s=$('#summary');if(s)s.innerHTML=summaryHTML()}

/* checkout */
function pay(){
  if(!S.user){showAuth('Sign in to complete your booking.');return}
  if(!S.sel.size){toast('Pick at least one seat.','bad');return}
  var bk=bookedSet(S.show.id),clash=Array.from(S.sel).filter(function(x){return bk.has(x)});
  if(clash.length){clash.forEach(function(x){S.sel.delete(x)});updateSeats();toast('Seat '+clash.join(', ')+' was just taken. Please pick another.','bad');return}
  S.paying=true;updateSummary();
  setTimeout(function(){
    var seats=Array.from(S.sel),sh=S.show;
    var total=seats.reduce(function(a,s){return a+tierOf(s[0]).price+FEE},0);
    var b={id:'IM'+hash(sh.id+Date.now()+seats.join()).toString(36).toUpperCase().slice(0,6),showId:sh.id,movieId:sh.movie,theatre:sh.ti,date:sh.date,time:sh.time,seats:seats,total:total,method:S.method,status:'confirmed',user:S.user.name};
    var all=bookings();all.unshift(b);save('imv_bookings',all);
    S.last=b;S.paying=false;S.sel=new Set();go('confirm');
  },900);
}
function qrSvg(seed){
  var r=rng(hash(seed)),n=21,c='';
  function finder(x,y){return '<rect x="'+x+'" y="'+y+'" width="7" height="7" fill="currentColor"/><rect x="'+(x+1)+'" y="'+(y+1)+'" width="5" height="5" fill="var(--surface)"/><rect x="'+(x+2)+'" y="'+(y+2)+'" width="3" height="3" fill="currentColor"/>'}
  for(var y=0;y<n;y++)for(var x=0;x<n;x++){
    if((x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12))continue;
    if(r()>0.52)c+='<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="currentColor"/>';
  }
  return '<svg class="qr" viewBox="0 0 21 21" role="img" aria-label="Sample entry code" shape-rendering="crispEdges">'+c+finder(0,0)+finder(14,0)+finder(0,14)+'</svg>';
}
function ticketHTML(b){
  var m=movie(b.movieId)||{title:'Film',genre:'',lang:''};
  return '<div class="ticket"><div class="tmain"><div><span class="eyebrow">Admit '+b.seats.length+'</span><h2 style="margin-top:6px">'+esc(m.title)+'</h2></div>'+
   '<dl class="tgrid" style="margin:0"><div><dt>Theatre</dt><dd>'+THEATRES[b.theatre].name+'</dd></div><div><dt>Date</dt><dd>'+longDay(b.date)+'</dd></div><div><dt>Time</dt><dd class="mono">'+b.time+'</dd></div>'+
   '<div><dt>Seats</dt><dd class="mono">'+b.seats.join(', ')+'</dd></div><div><dt>Paid</dt><dd class="mono">'+money(b.total)+'</dd></div><div><dt>Screen</dt><dd>'+THEATRES[b.theatre].info.split(' · ')[0]+'</dd></div></dl></div>'+
   '<div class="stub">'+qrSvg(b.id)+'<div class="mono" style="font-weight:500;letter-spacing:.1em">'+b.id+'</div><div class="note">Demo ticket</div></div></div>';
}
function renderConfirm(){
  var b=S.last;if(!b){go('browse');return}
  $('#main').innerHTML='<div class="ok">✓ Payment received, booking confirmed</div><h1>You’re in</h1>'+ticketHTML(b)+
   '<div class="actions"><button class="btn" data-go="bookings">View my bookings</button><button class="btn ghost" data-go="browse">Book another film</button></div>';
}

/* bookings */
function renderBookings(){
  var today=dkey(new Date()),all=bookings();
  var up=all.filter(function(b){return b.date>=today&&b.status==='confirmed'}),past=all.filter(function(b){return !(b.date>=today&&b.status==='confirmed')});
  var list=S.tab==='upcoming'?up:past;
  $('#main').innerHTML='<div class="head"><span class="eyebrow">Your tickets</span><h1>My bookings</h1></div>'+
   '<div class="tabs"><button class="chip" data-act="tab" data-v="upcoming" aria-pressed="'+(S.tab==='upcoming')+'">Upcoming ('+up.length+')</button><button class="chip" data-act="tab" data-v="past" aria-pressed="'+(S.tab==='past')+'">Past and cancelled ('+past.length+')</button></div>'+
   (list.length?'<div class="blist">'+list.map(function(b){
     var m=movie(b.movieId)||{title:'Removed film',c:0,genre:'',lang:''};
     var canCancel=S.tab==='upcoming';
     return '<article class="bk">'+poster(m)+'<div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h3>'+esc(m.title)+'</h3><span class="status '+b.status+'">'+b.status+'</span>'+(b.sample?'<span class="pill">Sample</span>':'')+'</div>'+
      '<div class="muted" style="margin:4px 0 10px">'+THEATRES[b.theatre].name+' · '+longDay(b.date)+' · <span class="mono">'+b.time+'</span></div>'+
      '<div class="meta"><span class="mono">Seats '+b.seats.join(', ')+'</span><span class="mono">'+money(b.total)+'</span><span class="mono">'+b.id+'</span></div>'+
      (canCancel?(S.confirmCancel===b.id?'<div class="actions" style="margin-top:12px"><span class="note" style="align-self:center">Cancel and refund '+money(b.total)+'?</span><button class="btn danger sm" data-act="cancelyes" data-id="'+b.id+'">Yes, cancel</button><button class="btn ghost sm" data-act="cancelno">Keep booking</button></div>'
        :'<div class="actions" style="margin-top:12px"><button class="btn ghost sm" data-act="cancel" data-id="'+b.id+'">Cancel booking</button></div>'):'')+
      '</div></article>'}).join('')+'</div>'
    :'<div class="empty">'+(S.tab==='upcoming'?'No upcoming bookings. Pick a film and your seats are a minute away.':'Nothing here yet.')+'</div>');
}

/* admin */
function renderAdmin(){
  if(!S.user||S.user.role!=='admin'){$('#main').innerHTML='<div class="empty">The admin panel is for admin accounts. Sign in and choose the Admin role.</div>';return}
  var all=bookings(),ok=all.filter(function(b){return b.status==='confirmed'});
  var rev=ok.reduce(function(a,b){return a+b.total},0),seats=ok.reduce(function(a,b){return a+b.seats.length},0);
  $('#main').innerHTML='<div class="head"><span class="eyebrow">Management</span><h1>Admin panel</h1></div>'+
   '<div class="stats"><div class="stat"><b>'+movies.length+'</b><span>Active titles</span></div><div class="stat"><b>'+ok.length+'</b><span>Confirmed bookings</span></div><div class="stat"><b>'+seats+'</b><span>Seats sold</span></div><div class="stat"><b class="mono" style="font-size:28px">'+money(rev)+'</b><span>Revenue</span></div></div>'+
   '<h3>Add a movie</h3><form class="form" id="addmovie"><label>Title<input class="field" id="am-t" required maxlength="40" placeholder="Film title"></label>'+
   '<label>Genre<select class="field" id="am-g"><option>Action</option><option>Comedy</option><option>Drama</option><option>Romance</option><option>Sci-Fi</option><option>Thriller</option></select></label>'+
   '<label>Language<select class="field" id="am-l"><option>Hindi</option><option>English</option><option>Tamil</option><option>Telugu</option><option>Malayalam</option></select></label>'+
   '<label>Duration (minutes)<input class="field" id="am-d" type="number" min="60" max="240" value="120" required></label><button class="btn" type="submit">Add movie</button></form>'+
   '<h3 style="margin-bottom:12px">Catalogue</h3><div class="tablewrap"><table><thead><tr><th>Title</th><th>Genre</th><th>Language</th><th>Length</th><th></th></tr></thead><tbody>'+
   movies.map(function(m){return '<tr><td>'+esc(m.title)+'</td><td>'+esc(m.genre)+'</td><td>'+esc(m.lang)+'</td><td class="mono">'+m.dur+'</td><td><button class="btn danger sm" data-act="delmovie" data-id="'+m.id+'">Remove</button></td></tr>'}).join('')+'</tbody></table></div>';
}

/* auth */
function showAuth(msg){
  var l=$('#authlayer');l.hidden=false;
  l.innerHTML='<form class="panel" id="authform" role="dialog" aria-modal="true" aria-label="Sign in"><h3>Sign in</h3><p class="muted" style="margin:0">'+esc(msg||'Sign in to book tickets and see your history.')+'</p>'+
   '<label>Name<input class="field" id="au-n" required maxlength="30" placeholder="Your name"></label><label>Email<input class="field" id="au-e" type="email" required placeholder="you@example.com"></label>'+
   '<label>Role<select class="field" id="au-r"><option value="user">Customer</option><option value="admin">Admin (opens the management panel)</option></select></label>'+
   '<div class="actions"><button class="btn" type="submit">Sign in</button><button class="btn ghost" type="button" data-act="closeauth">Cancel</button></div><p class="note" style="margin:0">Demo sign-in. Nothing is sent anywhere.</p></form>';
  setTimeout(function(){var n=$('#au-n');if(n)n.focus()},30);
}
function closeAuth(){$('#authlayer').hidden=true;$('#authlayer').innerHTML=''}
function renderUser(){
  var u=S.user;
  $('#userbox').innerHTML=u?'<span class="role">'+(u.role==='admin'?'Admin':'Customer')+'</span><span class="avatar" title="'+esc(u.name)+'">'+esc(u.name.trim().slice(0,2).toUpperCase())+'</span><button class="link" data-act="signout">Sign out</button>':'<button class="btn sm" data-act="signin">Sign in</button>';
  $('#nav-admin').hidden=!(u&&u.role==='admin');
}

/* router */
function go(v){S.view=v;S.confirmCancel=null;render();window.scrollTo(0,0)}
function render(){
  renderUser();
  ['browse','bookings','admin'].forEach(function(k){var b=$('#nav-'+k);if(!b)return;var on=S.view===k||(k==='browse'&&(S.view==='book'||S.view==='confirm'));if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(S.view==='browse')renderBrowse();else if(S.view==='book')renderBook();else if(S.view==='confirm')renderConfirm();else if(S.view==='bookings')renderBookings();else if(S.view==='admin')renderAdmin();
}

/* events */
document.addEventListener('click',function(e){
  var g=e.target.closest('[data-go]');
  if(g){go(g.dataset.go);return}
  var a=e.target.closest('[data-act]');if(!a)return;
  var act=a.dataset.act,v=a.dataset.v,id=a.dataset.id;
  if(act==='open')openMovie(+id);
  else if(act==='back')go('browse');
  else if(act==='more'){S.limit+=12;renderResults()}
  else if(act==='date'){S.date=v;S.limit=12;renderBrowse()}
  else if(act==='bdate'){S.bdate=v;S.sel=new Set();pickDefaultShow();renderBook()}
  else if(act==='show'){S.show=showById(id);S.sel=new Set();renderBook()}
  else if(act==='seat'){
    if(S.sel.has(v))S.sel.delete(v);
    else if(S.sel.size>=MAXSEATS){toast('You can book up to '+MAXSEATS+' seats at a time.','bad');return}
    else S.sel.add(v);
    updateSeats();
  }
  else if(act==='pay')pay();
  else if(act==='tab'){S.tab=v;S.confirmCancel=null;renderBookings()}
  else if(act==='cancel'){S.confirmCancel=id;renderBookings()}
  else if(act==='cancelno'){S.confirmCancel=null;renderBookings()}
  else if(act==='cancelyes'){
    var all=bookings();all.forEach(function(b){if(b.id===id)b.status='cancelled'});save('imv_bookings',all);S.confirmCancel=null;
    toast('Booking cancelled. Refund goes back to your original payment method.');renderBookings();
  }
  else if(act==='signin')showAuth();
  else if(act==='closeauth')closeAuth();
  else if(act==='signout'){S.user=null;save('imv_user',null);if(S.view==='admin')S.view='browse';toast('Signed out.');render()}
  else if(act==='delmovie'){movies=movies.filter(function(m){return m.id!==+id});toast('Movie removed from the catalogue.');renderAdmin()}
});
document.addEventListener('input',function(e){
  if(e.target.id==='q'){S.q=e.target.value;renderResults()}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='fg'){S.genre=t.value;renderResults()}
  else if(t.id==='fl'){S.lang=t.value;renderResults()}
  else if(t.id==='ft'){S.theatre=t.value;renderResults()}
  else if(t.name==='pm'){S.method=t.value}
});
document.addEventListener('submit',function(e){
  e.preventDefault();
  if(e.target.id==='authform'){
    S.user={name:$('#au-n').value.trim()||'Guest',email:$('#au-e').value.trim(),role:$('#au-r').value};
    save('imv_user',S.user);closeAuth();toast('Signed in as '+S.user.name+'.');render();
  }else if(e.target.id==='addmovie'){
    var nid=movies.reduce(function(a,m){return Math.max(a,m.id)},0)+1,d=+$('#am-d').value;
    movies.push({id:nid,title:$('#am-t').value.trim(),genre:$('#am-g').value,lang:$('#am-l').value,dur:Math.floor(d/60)+'h '+String(d%60).padStart(2,'0')+'m',cert:'U/A',score:7.0,c:nid%COLORS.length,desc:'Newly added by the admin team. Showtimes are generated for the next five days.'});
    toast('Movie added. It is now listed under Now showing.');renderAdmin();
  }
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#authlayer').hidden)closeAuth()});

/* live availability: another customer books a seat every few seconds */
setInterval(function(){
  if(S.view!=='book'||!S.show||document.hidden)return;
  var bk=bookedSet(S.show.id),free=[];
  ROWS.forEach(function(r){for(var n=1;n<=COLS;n++){var id=r+n;if(!bk.has(id)&&!S.sel.has(id))free.push(id)}});
  if(free.length<6)return;
  var pick=free[Math.floor(Math.random()*free.length)];
  (live[S.show.id]=live[S.show.id]||[]).push(pick);
  updateSeats();
},5000);

render();
})();