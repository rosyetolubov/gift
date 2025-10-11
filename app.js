(() => {
  // ===== DOM
  const canvas   = document.getElementById('fx');
  const ctx      = canvas.getContext('2d', { alpha: false });
  const backBtn  = document.getElementById('backBtn');
  const musicBtn = document.getElementById('musicBtn');
  const audio    = document.getElementById('music');

  // ===== Музыка по внешней ссылке
  const musicURL = document.documentElement.getAttribute('data-music');
  if (musicURL) audio.src = musicURL;

  // ===== Canvas DPR/resize
  let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width  = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize, { passive:true });
  resize();

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== Параметры салюта
  const GRAVITY = 0.09;
  const AIR = 0.985;
  const SPARK_AIR = 0.96;
  const BASE_HUE_SPEED = 0.2;

  const rockets = [];
  const sparks  = [];
  const flashes = []; // всполохи для подсветки фона

  const rand = (a,b)=>a+Math.random()*(b-a);
  const randInt = (a,b)=>a+Math.floor(Math.random()*(b-a+1));
  const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
  let globalHue = rand(0,360);

  // ===== Классы
  class Rocket{
    constructor(sx,sy,tx,ty){
      this.x=sx; this.y=sy;
      const ang = Math.atan2(ty-sy, tx-sx);
      const power = rand(8,11);
      this.vx = Math.cos(ang)*power;
      this.vy = Math.sin(ang)*power;
      this.tx=tx; this.ty=ty;
      this.alive=true;
      this.trail=[];
    }
    update(dt){
      this.trail.push([this.x,this.y]); if(this.trail.length>6)this.trail.shift();

      const airPow = Math.pow(AIR, dt*60);
      this.vy += GRAVITY*0.25*dt*60;
      this.vx *= airPow; this.vy *= airPow;

      this.x += this.vx*dt*60;
      this.y += this.vy*dt*60;

      const d = dist(this.x,this.y,this.tx,this.ty);
      if(d<12 || this.vy>=0){
        explode(this.x,this.y);
        this.alive=false;
      }
    }
    draw(){
      ctx.beginPath();
      const last = this.trail[0] || [this.x,this.y];
      ctx.moveTo(last[0], last[1]); ctx.lineTo(this.x, this.y);
      ctx.strokeStyle=`hsl(${globalHue},100%,70%)`;
      ctx.lineWidth=1.6;
      ctx.stroke();

      ctx.fillStyle=`hsl(${globalHue},100%,60%)`;
      ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fill();
    }
  }

  class Spark{
    constructor(x,y,hue,speed,alpha){
      this.x=x; this.y=y;
      const a = rand(0,Math.PI*2), sp = speed*(0.5+Math.random()*0.7);
      this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp;
      this.life=rand(0.9,1.4); this.age=0;
      this.alpha=alpha; this.baseAlpha=alpha;
      this.hue=hue+rand(-14,14);
      this.size=rand(1.1,2.2);
      this.trail=[];
      this.flicker=Math.random()<0.25;
      this.glow=Math.random()<0.4;
    }
    update(dt){
      this.age+=dt; if(this.age>=this.life){ this.alpha=0; return; }
      this.trail.push([this.x,this.y]); if(this.trail.length>7)this.trail.shift();

      const airPow = Math.pow(SPARK_AIR, dt*60);
      this.vy += GRAVITY*dt*60;
      this.vx *= airPow; this.vy *= airPow;

      this.x += this.vx*dt*60;
      this.y += this.vy*dt*60;

      const t=this.age/this.life;
      this.alpha=this.baseAlpha*(1-t)*(this.flicker?(0.65+Math.random()*0.35):1);
    }
    draw(){
      if(this.alpha<=0)return;

      if(this.trail.length>1){
        ctx.beginPath();
        const [sx,sy]=this.trail[0]; ctx.moveTo(sx,sy);
        for(let i=1;i<this.trail.length;i++){ const [x,y]=this.trail[i]; ctx.lineTo(x,y); }
        ctx.strokeStyle=`hsla(${this.hue},100%,60%,${this.alpha*0.35})`;
        ctx.lineWidth=1.1; ctx.stroke();
      }

      ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
      ctx.fillStyle=`hsla(${this.hue},100%,${this.glow?70:55}%,${this.alpha})`;
      ctx.fill();
    }
  }

  // Всполох-подсветка
  class Flash{
    constructor(x,y,hue){
      this.x=x; this.y=y; this.hue=hue;
      this.r = 40;
      this.alpha = 0.45;
    }
    update(dt){
      this.r += 900*dt;
      this.alpha *= Math.pow(0.5, dt*2);
      if(this.alpha < 0.02) this.alpha = 0;
    }
    draw(){
      if(this.alpha<=0) return;
      const g = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r);
      g.addColorStop(0,`hsla(${this.hue}, 100%, 70%, ${this.alpha})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation='screen';
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  // ===== Логика
  function explode(x,y){
    const hue = globalHue;
    globalHue = (globalHue + rand(18,36)) % 360;
    flashes.push(new Flash(x,y,hue));

    if(reduceMotion){
      for(let i=0;i<36;i++) sparks.push(new Spark(x,y,hue,rand(2.3,3.2),0.9));
      return;
    }
    const count = randInt(90,130), speed = rand(3.0,4.8);
    for(let i=0;i<count;i++) sparks.push(new Spark(x,y,hue,speed,1));
    if(Math.random()<0.5){
      const ring = randInt(28,44);
      for(let i=0;i<ring;i++){
        const s = new Spark(x,y,hue+180,rand(2.0,2.6),0.85);
        const a = (i/ring)*Math.PI*2;
        s.vx = Math.cos(a)*rand(2.0,2.6);
        s.vy = Math.sin(a)*rand(2.0,2.6);
        sparks.push(s);
      }
    }
  }

  function launchRandom(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const sx = rand(w*0.2, w*0.8), sy = h+10;
    const tx = rand(w*0.15, w*0.85), ty = rand(h*0.15, h*0.45);
    rockets.push(new Rocket(sx,sy,tx,ty));
  }

  // ===== Плавная симуляция (фиксированный шаг)
  const STEP = 1/120;
  const MAX_ACC = 0.05;
  let acc = 0;
  let prev = performance.now();
  let autoTimer = 0;

  function update(dt){
    autoTimer += dt;
    const period = reduceMotion ? 1.6 : 0.9;
    if(autoTimer>period){ autoTimer=0; launchRandom(); }

    for(let i=rockets.length-1;i>=0;i--){
      const r=rockets[i]; r.update(dt);
      if(!r.alive) rockets.splice(i,1);
    }
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i]; s.update(dt);
      if(s.alpha<=0 || s.y>canvas.clientHeight+50) sparks.splice(i,1);
    }
    for(let i=flashes.length-1;i>=0;i--){
      const f=flashes[i]; f.update(dt);
      if(f.alpha<=0) flashes.splice(i,1);
    }
    globalHue = (globalHue + BASE_HUE_SPEED*dt*60) % 360;
  }

  function render(){
    ctx.fillStyle='rgba(2,4,10,0.30)';
    ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);

    for(let i=0;i<flashes.length;i++) flashes[i].draw();
    for(let i=0;i<rockets.length;i++) rockets[i].draw();
    for(let i=0;i<sparks.length;i++)  sparks[i].draw();
  }

  function frame(now){
    let dt = (now - prev)/1000; prev = now;
    if (dt > MAX_ACC) dt = MAX_ACC;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }

  // старт
  ctx.fillStyle='rgb(2,4,10)'; ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);
  requestAnimationFrame(frame);

  // ===== Back button
  backBtn.addEventListener('click', () => {
    if (document.referrer && history.length > 1) {
      history.back();
    } else {
      location.href = 'index.html';
    }
  });

  // ===== Музыка
  let isPlaying = false;
  async function toggleMusic(){
    try{
      if(!isPlaying){
        await audio.play();
        isPlaying=true; musicBtn.textContent='⏸ Музыка';
      }else{
        audio.pause();
        isPlaying=false; musicBtn.textContent='▶ Музыка';
      }
    }catch(e){
      musicBtn.textContent='▶ Разреши звук в браузере';
      console.warn(e);
    }
  }
  musicBtn.addEventListener('click', toggleMusic);
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='m') toggleMusic(); });

  // ===== Анимация печатания поздравления
  const typedEl  = document.getElementById('typed');
  const message  =  `Ты — целый мир, в котором хочется быть.
С тобой всё становится светлее, спокойнее и настоящим.
Я видел, как ты улыбаешься, и это всегда делало мой день лучше.
Ты наполняешь жизнь смыслом, теплом и каким-то особенным уютом, который ни с чем не спутать.

Я очень ценю тебя и рад, что ты появилась в моей жизни.
Ты мне действительно дорога, и я верю в тебя — в твои силы, в твои мечты, в то, что у тебя всё получится.
Ты заслуживаешь только самого лучшего: счастья, уверенности, душевного тепла и людей рядом, которые будут беречь тебя так, как ты того достойна.

Ты — лучшая Бибизянка.`;

  const typebase = 26; // базовая скорость (мс на символ)
  const jitter   = 40; // случайное дрожание скорости

  function typeMessage(text){
    if(!typedEl) return;
    if (reduceMotion) { // уважим prefers-reduced-motion
      typedEl.textContent = text;
      const caret = document.querySelector('.caret');
      if (caret) caret.style.opacity = '0.5';
      return;
    }
    typedEl.textContent = '';
    let i = 0;
    const tick = () => {
      if (i <= text.length){
        typedEl.textContent = text.slice(0, i++);
        const delay = typebase + Math.random()*jitter;
        setTimeout(tick, delay);
      }
    };
    tick();
  }

  // Стартуем печать через небольшую паузу
  setTimeout(()=> typeMessage(message), 400);
})();
