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
      img.closest('figure,.hero-cover,.chapter-photo,.gallery-tile')?.classList.add('is-missing');
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

function renderLifeChapter(item,index){
  const photos=(item.photos||[]).slice(0,3);
  const accents=['var(--peach)','var(--mint)','var(--lavender)','var(--sky)'];
  const photoHTML=photos.length?photos.map((photo,photoIndex)=>`
    <figure class="chapter-photo" style="--photo-index:${photoIndex}">
      <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt||item.title)}" loading="lazy">
    </figure>`).join(''):`<div class="empty-photo">Photo slot</div>`;

  return `<article class="life-chapter reveal" style="--accent:${accents[index%accents.length]}">
    <div class="chapter-copy">
      <span class="chapter-year">${escapeHTML(item.year||'Now')}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.body)}</p>
    </div>
    <div class="chapter-photos" aria-label="${escapeHTML(item.title)} photos">${photoHTML}</div>
  </article>`;
}

function renderLife(intro){
  const life=getSection(intro,'life');
  const items=life?.items||[];
  return `<section class="chapter-section" id="life">
    <div class="section-heading reveal">
      <span class="section-kicker">01</span>
      <h2 class="section-title">${escapeHTML(life?.title||'Life Experience')}</h2>
      <p class="section-summary">${escapeHTML(life?.summary||'')}</p>
    </div>
    <div class="chapter-list">
      ${items.length?items.map(renderLifeChapter).join(''):'<div class="status-message">Add life experience chapters in data.json.</div>'}
    </div>
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
      <p class="section-summary">${escapeHTML([hobbies?.summary,casual?.summary].filter(Boolean).join(' '))}</p>
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
