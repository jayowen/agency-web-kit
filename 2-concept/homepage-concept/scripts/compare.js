const S=document.getElementById('stage');let dev='desktop',mode='slider',oi=0;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ok=p=>typeof p==='string'&&/^[\w][\w./-]*$/.test(p)&&!p.includes('..');
function opt(){const o=D.opts[oi];document.getElementById('open').href=ok(o.concept)?o.concept:'concept/index.html';document.getElementById('chg').innerHTML=(o.changes||[]).map(x=>'<li>'+esc(x)+'</li>').join('');document.getElementById('thesis').textContent=o.design_thesis||'';document.getElementById('sw').innerHTML=(o.palette||[]).map(h=>'<i title="'+esc(h)+'" style="background:'+esc(h)+'"></i>').join('');document.getElementById('fonts').textContent=(o.fonts||[]).join(' + ');if(o.tagline)document.getElementById('tagline').textContent=o.tagline;document.querySelectorAll('[data-o]').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.o===oi));}
function draw(){const b=esc(ok(D.before[dev])?D.before[dev]:''),a=esc(ok(D.opts[oi].after[dev])?D.opts[oi].after[dev]:'');
 if(dev==='desktop'&&mode==='slider'){S.innerHTML=`<div class="cmp" id="c"><div class="s"><div class="l"><img src="${b}" alt="Current homepage"><img class="o" src="${a}" alt="New homepage concept"></div></div><span class="tag b">Before</span><span class="tag a">After</span><div class="h"><button class="g" id="g" aria-label="Drag to compare">&#8596;</button></div></div>`;wire()}
 else{S.innerHTML=`<div class="sbs ${dev==='mobile'?'m':''}"><div><p>Before</p><div class="f"><img src="${b}" alt="Current homepage"></div></div><div><p>After</p><div class="f"><img src="${a}" alt="New homepage concept"></div></div></div>`;sync()}
 document.querySelectorAll('[data-d]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.d===dev));
 document.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.m===mode));
 document.getElementById('mseg').style.visibility=dev==='desktop'?'visible':'hidden'}
function wire(){const c=document.getElementById('c'),g=document.getElementById('g');let on=false;
 const set=v=>c.style.setProperty('--x',Math.max(0,Math.min(100,v))+'%');const at=e=>{const r=c.getBoundingClientRect();set((e.clientX-r.left)/r.width*100)};
 g.onpointerdown=e=>{on=true;g.setPointerCapture(e.pointerId)};g.onpointermove=e=>on&&at(e);g.onpointerup=()=>on=false;
 c.addEventListener('click',e=>{if(e.target!==g)at(e)});
 g.onkeydown=e=>{const v=parseFloat(c.style.getPropertyValue('--x'))||50;if(e.key==='ArrowLeft')set(v-5);if(e.key==='ArrowRight')set(v+5)}}
function sync(){const f=[...document.querySelectorAll('.sbs .f')];let l=false;f.forEach((x,i)=>x.onscroll=()=>{if(l)return;l=true;const o=f[1-i];o.scrollTop=x.scrollTop/Math.max(1,x.scrollHeight-x.clientHeight)*(o.scrollHeight-o.clientHeight);requestAnimationFrame(()=>l=false)})}
document.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{dev=x.dataset.d;draw()});
document.querySelectorAll('[data-m]').forEach(x=>x.onclick=()=>{mode=x.dataset.m;draw()});
document.querySelectorAll('[data-o]').forEach(x=>x.onclick=()=>{oi=+x.dataset.o;opt();draw()});opt();draw();
