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

function imageBlock(src,alt,caption,className='card-image'){
  return `<div class="${className}">
    <img src="${escapeHTML(src)}" alt="${escapeHTML(alt||caption||'Self intro photo')}" loading="lazy">
    ${caption?`<span class="photo-caption">${escapeHTML(caption)}</span>`:''}
  </div>`;
}

function markMissingImages(){
  document.querySelectorAll('img').forEach(img=>{
    const handleMissing=()=>{
      img.parentElement?.classList.add('is-missing');
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
    if(el.getBoundingClientRect().top<windowHeight-90)el.classList.add('visible');
  });
}

function getSection(intro,id){
  return (intro.sections||[]).find(section=>section.id===id);
}

function sectionChips(intro){
  return `<nav class="quick-nav" aria-label="Self intro sections">
    ${(intro.sections||[]).map(section=>`<a class="section-chip" href="#${escapeHTML(section.id)}">${escapeHTML(section.title)}</a>`).join('')}
  </nav>`;
}

function heroPhotos(intro){
  const photos=getSection(intro,'photos')?.photos||[];
  const fallback=[
    {src:intro.hero?.coverImage,caption:'Cover'},
    {src:'assets/self-intro/photo-01.jpg',caption:'Daily life'},
    {src:'assets/self-intro/photo-02.jpg',caption:'Small moments'}
  ];
  return (photos.length?photos:fallback).slice(0,3);
}

function renderHero(intro){
  const photos=heroPhotos(intro).map(photo=>`<figure class="photo-card">
    <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt||photo.caption||'Self intro photo')}" loading="eager">
    <figcaption class="photo-caption">${escapeHTML(photo.caption||'Photo slot')}</figcaption>
  </figure>`).join('');

  return `<section class="hero-panel reveal">
    <div>
      <span class="eyebrow">${escapeHTML(intro.title)}</span>
      <h1 class="page-title">${escapeHTML(intro.hero?.headline||intro.title)}</h1>
      <p class="page-subtitle">${escapeHTML(intro.hero?.body||intro.subtitle)}</p>
      <div class="hero-actions">
        <a class="button-link" href="index.html#self-intro">Back Home</a>
        <a class="button-link secondary" href="#photos">See Photos</a>
      </div>
      ${sectionChips(intro)}
    </div>
    <div class="hero-stack" aria-label="Photo preview">${photos}</div>
  </section>`;
}

function renderItems(section,accent){
  const items=section.items||[];
  if(!items.length){
    return `<div class="status-message">Add ${escapeHTML(section.title.toLowerCase())} items in data.json.</div>`;
  }
  return `<div class="card-grid">
    ${items.map(item=>`<article class="story-card reveal" style="--accent:${accent}">
      ${imageBlock(item.image||'',item.title,item.title)}
      <div class="card-body">
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.body)}</p>
      </div>
    </article>`).join('')}
  </div>`;
}

function renderPhotos(section){
  const photos=section.photos||[];
  if(!photos.length){
    return `<div class="status-message">Add personal photos in assets/self-intro and list them in data.json.</div>`;
  }
  return `<div class="card-grid">
    ${photos.map(photo=>`<article class="gallery-card reveal" style="--accent:var(--sky)">
      ${imageBlock(photo.src,photo.alt,photo.caption)}
      <div class="card-body">
        <span class="caption">${escapeHTML(photo.caption)}</span>
      </div>
    </article>`).join('')}
  </div>`;
}

function renderSection(section,index){
  const accents=['var(--peach)','var(--mint)','var(--lavender)','var(--sky)'];
  const content=section.id==='photos'?renderPhotos(section):renderItems(section,accents[index%accents.length]);
  return `<section class="section" id="${escapeHTML(section.id)}">
    <div class="content-section reveal">
      <div>
        <span class="section-kicker">${String(index+1).padStart(2,'0')}</span>
        <h2 class="section-title">${escapeHTML(section.title)}</h2>
        <p class="section-summary">${escapeHTML(section.summary)}</p>
      </div>
      ${content}
    </div>
  </section>`;
}

function renderPage(intro){
  app.innerHTML=[
    renderHero(intro),
    ...(intro.sections||[]).map(renderSection)
  ].join('');
  markMissingImages();
  revealOnScroll();
}

window.addEventListener('scroll',revealOnScroll,{passive:true});
window.addEventListener('load',revealOnScroll);

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
