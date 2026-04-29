const app=document.getElementById('app');

function escapeHTML(value){
  return String(value ?? '').replace(/[&<>"']/g,char=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));
}

function getSection(intro,id){
  return (intro.sections||[]).find(section=>section.id===id);
}

function sectionPhotos(section){
  return (section?.items||[]).flatMap(item=>(item.photos||[]).map(photo=>({
    ...photo,
    groupTitle:item.title,
    body:item.body
  })));
}

function allIntroPhotos(intro){
  return (intro.sections||[]).flatMap(section=>sectionPhotos(section).map(photo=>({
    ...photo,
    sectionId:section.id,
    sectionTitle:section.title
  })));
}

function markMissingImages(){
  document.querySelectorAll('img').forEach(img=>{
    const handleMissing=()=>{
      img.closest('figure,.hero-cover,.life-scene-photo,.gallery-tile')?.classList.add('is-missing');
    };
    if(img.complete&&img.naturalWidth===0)handleMissing();
    img.addEventListener('error',handleMissing,{once:true});
  });
}

function revealOnScroll(){
  const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(prefersReduced){
    document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));
    return;
  }
  const windowHeight=window.innerHeight;
  document.querySelectorAll('.reveal:not(.visible)').forEach(el=>{
    if(el.getBoundingClientRect().top<windowHeight-110)el.classList.add('visible');
  });
}

function renderHero(intro){
  const heroPhotos=allIntroPhotos(intro).slice(0,3);
  const cover=intro.hero?.coverImage||heroPhotos[0]?.src||'';
  const stack=heroPhotos.map((photo,index)=>`
    <figure class="hero-snap" style="--i:${index}">
      <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt||photo.groupTitle||'Self intro photo')}" loading="${index===0?'eager':'lazy'}">
      <figcaption>${escapeHTML(photo.groupTitle||photo.sectionTitle||'Photo')}</figcaption>
    </figure>`).join('');

  return `<section class="hero-panel reveal">
    <div class="hero-copy">
      <span class="eyebrow">${escapeHTML(intro.title)}</span>
      <h1 class="page-title">${escapeHTML(intro.hero?.headline||intro.title)}</h1>
      <p class="page-subtitle">${escapeHTML(intro.hero?.body||intro.subtitle)}</p>
      <div class="hero-actions">
        <a class="button-link" href="index.html#self-intro">Back Home</a>
        <a class="button-link secondary" href="#life">Life Chapters</a>
        <a class="button-link secondary" href="#hobbies-casual">Gallery</a>
      </div>
    </div>
    <div class="hero-media">
      <figure class="hero-cover">
        <img src="${escapeHTML(cover)}" alt="${escapeHTML(intro.hero?.headline||'Self intro cover')}" loading="eager">
      </figure>
      <div class="hero-snap-stack" aria-label="Self intro photo preview">${stack}</div>
    </div>
  </section>`;
}

function lifePhotos(items){
  return items.flatMap(item=>(item.photos||[]).map(photo=>({
    ...photo,
    chapterTitle:item.title
  }))).slice(0,6);
}

function renderLifePanel(item,index){
  return `<article class="life-text-panel ${index===0?'is-active':''}" data-life-panel="${index}">
    <span class="chapter-year">${escapeHTML(item.year||'Now')}</span>
    <h3>${escapeHTML(item.title)}</h3>
    <p>${escapeHTML(item.body)}</p>
  </article>`;
}

function renderLifePhotos(items){
  const photos=lifePhotos(items);
  if(!photos.length)return '<div class="empty-photo">Photo slot</div>';
  return photos.map((photo,index)=>{
    const hasDescription=Boolean(photo.description);
    return `
    <figure class="life-scene-photo ${hasDescription?'has-description':''}" style="--photo-index:${index}" tabindex="0">
      <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt||photo.chapterTitle||'Life experience photo')}" loading="${index<2?'eager':'lazy'}">
      ${hasDescription?`<figcaption>${escapeHTML(photo.description)}</figcaption>`:''}
    </figure>`;
  }).join('');
}

function renderLife(intro){
  const life=getSection(intro,'life');
  const items=life?.items||[];
  return `<section class="chapter-section" id="life">
    <div class="section-heading reveal">
      <span class="section-kicker">01</span>
      <h2 class="section-title">${escapeHTML(life?.title||'Life Experience')}</h2>
    </div>
    ${items.length?`<div class="life-scroll-track" style="--life-track-height:${items.length*100}svh;--life-track-height-mobile:${items.length*92}svh">
      <div class="life-sticky-scene" data-life-scene>
        <div class="life-copy-stack">
          ${items.map(renderLifePanel).join('')}
        </div>
        <div class="life-photo-composition" aria-label="Life experience photo composition">
          ${renderLifePhotos(items)}
        </div>
        <div class="life-progress-dots" aria-hidden="true">
          ${items.map((_,index)=>`<span class="${index===0?'is-active':''}" data-life-dot="${index}"></span>`).join('')}
        </div>
      </div>
    </div>`:'<div class="status-message">Add life experience chapters in data.json.</div>'}
  </section>`;
}

function renderGalleryTile(photo,index){
  const hasDescription=Boolean(photo.description);
  return `<figure class="gallery-tile reveal ${hasDescription?'has-description':''}" style="--span:${index%5===0?2:1}" tabindex="0">
    <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt||photo.groupTitle||'Self intro gallery photo')}" loading="lazy">
    ${hasDescription?`<figcaption>${escapeHTML(photo.description)}</figcaption>`:''}
  </figure>`;
}

function renderGallery(intro){
  const hobbies=getSection(intro,'hobbies');
  const casual=getSection(intro,'casual');
  const photos=[...sectionPhotos(hobbies),...sectionPhotos(casual)];
  return `<section class="gallery-section" id="hobbies-casual">
    <div class="section-heading reveal">
      <span class="section-kicker">02</span>
      <h2 class="section-title">Hobbies & Casual Activities</h2>
    </div>
    ${photos.length?`<div class="masonry-gallery">${photos.map(renderGalleryTile).join('')}</div>`:'<div class="status-message">Add hobby and casual photos in data.json.</div>'}
  </section>`;
}

function renderPage(intro){
  if(!intro){
    app.innerHTML='<div class="status-message">Self Intro data is missing.</div>';
    return;
  }
  app.innerHTML=[
    renderHero(intro),
    renderLife(intro),
    renderGallery(intro)
  ].join('');
  markMissingImages();
  revealOnScroll();
  updateLifeScene();
}

let lifeTicking=false;
function updateLifeScene(){
  const track=document.querySelector('.life-scroll-track');
  if(!track)return;
  const panels=[...document.querySelectorAll('[data-life-panel]')];
  const dots=[...document.querySelectorAll('[data-life-dot]')];
  if(!panels.length)return;
  const rect=track.getBoundingClientRect();
  const scrollable=Math.max(1,track.offsetHeight-window.innerHeight);
  const progress=Math.min(1,Math.max(0,-rect.top/scrollable));
  const activeIndex=Math.min(panels.length-1,Math.floor(progress*panels.length));
  panels.forEach((panel,index)=>panel.classList.toggle('is-active',index===activeIndex));
  dots.forEach((dot,index)=>dot.classList.toggle('is-active',index===activeIndex));
}

function scheduleLifeSceneUpdate(){
  if(lifeTicking)return;
  lifeTicking=true;
  requestAnimationFrame(()=>{
    updateLifeScene();
    lifeTicking=false;
  });
}

window.addEventListener('scroll',()=>{revealOnScroll();scheduleLifeSceneUpdate();},{passive:true});
window.addEventListener('resize',scheduleLifeSceneUpdate,{passive:true});
window.addEventListener('load',()=>{revealOnScroll();updateLifeScene();});

fetch('data.json')
  .then(response=>{
    if(!response.ok)throw new Error('Unable to load data.json');
    return response.json();
  })
  .then(data=>renderPage(data.selfIntro))
  .catch(error=>{
    app.innerHTML='<div class="status-message">Failed to load Self Intro data.</div>';
    console.error(error);
  });
