const moduleKey=document.body.dataset.module;
const app=document.getElementById('app');

const config={
  vibeCoding:{
    accent:'var(--sky)',
    listTitle:'Latest X Notes',
    readLabel:'Read on X',
    empty:'No builder notes yet.'
  },
  english:{
    accent:'var(--lavender)',
    listTitle:'Latest Language Input',
    readLabel:'Open Source',
    empty:'No English input yet.'
  },
  overseaMarketing:{
    accent:'var(--yellow)',
    listTitle:'Latest Marketing Signals',
    readLabel:'Read Source',
    empty:'No marketing signals yet.'
  }
};

function escapeHTML(value){
  return String(value ?? '').replace(/[&<>"']/g,char=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[char]));
}

function formatDate(value){
  if(!value)return 'No date';
  return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
}

function byNewest(a,b){
  return new Date(b.postedAt||0)-new Date(a.postedAt||0);
}

function storageKey(){
  return `leslieHub.saved.${moduleKey}`;
}

function loadSaved(){
  try{
    const parsed=JSON.parse(localStorage.getItem(storageKey())||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch(error){
    return [];
  }
}

function saveSaved(ids){
  localStorage.setItem(storageKey(),JSON.stringify(ids));
}

function sourceChips(module){
  if(moduleKey==='overseaMarketing'){
    return [...(module.sources.cn||[]),...(module.sources.en||[])].map(source=>source.name);
  }
  return (module.sources||[]).map(source=>source.handle?`@${source.handle}`:source.name);
}

function vibeItems(module){
  return (module.articles||[]).map(item=>({
    id:item.id,
    title:item.title,
    body:'',
    source:item.sourceName||item.source,
    meta:`@${item.source} · ${item.platform.toUpperCase()}`,
    url:item.url,
    postedAt:item.postedAt,
    type:'X'
  })).sort(byNewest);
}

function englishItems(module){
  const podcasts=(module.podcasts||[]).map(item=>({
    id:item.id,
    title:item.topic,
    body:'',
    source:item.source,
    meta:'Podcast topic',
    url:item.url,
    postedAt:item.postedAt,
    type:'Podcast'
  }));
  const books=(module.books||[]).flatMap(book=>(book.reviews||[]).map(review=>({
    id:review.id,
    title:book.title,
    body:review.text,
    source:review.reviewer,
    meta:`Book · ${book.author}`,
    url:review.url,
    postedAt:review.postedAt,
    type:'Book'
  })));
  const films=(module.films||[]).flatMap(film=>(film.reviews||[]).map(review=>({
    id:review.id,
    title:film.title,
    body:review.text,
    source:review.reviewer,
    meta:`Film · ${film.director} · ${film.year}`,
    url:review.url,
    postedAt:review.postedAt,
    type:'Film'
  })));
  return podcasts.concat(books,films).sort(byNewest);
}

function marketingItems(module){
  return (module.articles||[]).map(item=>({
    id:item.id,
    title:item.title,
    body:'',
    source:item.source,
    meta:`${item.lang.toUpperCase()} source`,
    url:item.url,
    postedAt:item.postedAt,
    type:item.lang,
    lang:item.lang
  })).sort(byNewest);
}

function getItems(module){
  if(moduleKey==='vibeCoding')return vibeItems(module);
  if(moduleKey==='english')return englishItems(module);
  return marketingItems(module);
}

function renderHero(module,items){
  return `<section class="hero-panel">
    <div>
      <span class="eyebrow">${escapeHTML(module.icon)} ${escapeHTML(module.title)}</span>
      <h1 class="page-title">${escapeHTML(module.title)}</h1>
      <p class="page-subtitle">${escapeHTML(module.subtitle)}</p>
    </div>
    <div class="hero-stats">
      <div class="stat-card"><div class="stat-label">Items</div><div class="stat-value">${items.length}</div></div>
      <div class="stat-card"><div class="stat-label">Updated</div><div class="stat-value">${escapeHTML(formatDate(module.lastUpdated))}</div></div>
    </div>
  </section>`;
}

function renderSources(module){
  const chips=sourceChips(module).map(source=>`<span class="source-chip">${escapeHTML(source)}</span>`).join('');
  const filters=moduleKey==='overseaMarketing'?`
    <div class="filter-row" aria-label="Language filter">
      <button class="filter-button active" type="button" data-filter="all">All</button>
      <button class="filter-button" type="button" data-filter="cn">CN</button>
      <button class="filter-button" type="button" data-filter="en">EN</button>
    </div>`:'';
  return `<aside class="side-panel">
    <h2 class="panel-title">Sources</h2>
    <div class="source-list">${chips}</div>
    ${filters}
  </aside>`;
}

function renderSaved(items,savedIds){
  const savedItems=savedIds.map(id=>items.find(item=>item.id===id)).filter(Boolean);
  if(!savedItems.length){
    return `<section class="saved-panel">
      <h2>Saved</h2>
      <p class="saved-empty">Pinned items will land here.</p>
    </section>`;
  }
  const saved=savedItems.map(item=>`
    <li class="saved-item">
      <span>${escapeHTML(item.title)}</span>
      <button class="pin-button" type="button" data-pin-id="${escapeHTML(item.id)}" aria-pressed="true">Unpin</button>
    </li>`).join('');
  return `<section class="saved-panel">
    <h2>Saved</h2>
    <ul class="saved-list">${saved}</ul>
  </section>`;
}

function renderCard(item,savedIds){
  const pinned=savedIds.includes(item.id);
  const body=item.body?`<p class="article-body">${escapeHTML(item.body)}</p>`:'';
  return `<article class="article-card" data-lang="${escapeHTML(item.lang||'all')}" style="--accent:${config[moduleKey].accent}">
    <div class="article-top">
      <span class="type-pill">${escapeHTML(item.type)}</span>
      <span class="article-date">${escapeHTML(formatDate(item.postedAt))}</span>
    </div>
    <h2 class="article-title">${escapeHTML(item.title)}</h2>
    ${body}
    <div class="article-meta">${escapeHTML(item.source)} · ${escapeHTML(item.meta)}</div>
    <div class="article-actions">
      <a class="read-link" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(config[moduleKey].readLabel)}</a>
      <button class="pin-button" type="button" data-pin-id="${escapeHTML(item.id)}" aria-pressed="${pinned}">${pinned?'Unpin':'Pin'}</button>
    </div>
  </article>`;
}

function renderList(items,savedIds,filter='all'){
  const visible=filter==='all'?items:items.filter(item=>item.lang===filter);
  const cards=visible.map(item=>renderCard(item,savedIds)).join('');
  return `<section class="list-panel">
    ${renderSaved(items,savedIds)}
    <div class="section-title-row">
      <h2>${escapeHTML(config[moduleKey].listTitle)}</h2>
      <span class="item-count">${visible.length} shown</span>
    </div>
    <div class="article-list">${cards||`<div class="status-message">${escapeHTML(config[moduleKey].empty)}</div>`}</div>
  </section>`;
}

function renderPage(data,filter='all'){
  const module=data.explore[moduleKey];
  const items=getItems(module);
  const savedIds=loadSaved();
  app.innerHTML=`
    ${renderHero(module,items)}
    <div class="content-grid">
      ${renderSources(module)}
      ${renderList(items,savedIds,filter)}
    </div>`;
  if(moduleKey==='overseaMarketing'){
    document.querySelectorAll('[data-filter]').forEach(button=>{
      button.classList.toggle('active',button.dataset.filter===filter);
    });
  }
}

let pageData=null;
let currentFilter='all';

fetch('data.json')
  .then(response=>{
    if(!response.ok)throw new Error('Unable to load data.json');
    return response.json();
  })
  .then(data=>{
    pageData=data;
    renderPage(pageData,currentFilter);
  })
  .catch(error=>{
    app.innerHTML=`<div class="status-message">Failed to load Explore data.</div>`;
    console.error(error);
  });

document.addEventListener('click',event=>{
  if(!pageData)return;

  const pinButton=event.target.closest('[data-pin-id]');
  if(pinButton){
    const id=pinButton.dataset.pinId;
    const savedIds=loadSaved();
    const next=savedIds.includes(id)?savedIds.filter(savedId=>savedId!==id):savedIds.concat(id);
    saveSaved(next);
    renderPage(pageData,currentFilter);
    return;
  }

  const filterButton=event.target.closest('[data-filter]');
  if(filterButton){
    currentFilter=filterButton.dataset.filter;
    renderPage(pageData,currentFilter);
  }
});
