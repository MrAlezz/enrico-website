(function(){
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function card(w, home){
    return `<article class="work-card" id="${esc(w.id)}" data-category="${esc(w.category)}">
      <div class="work-image-wrapper"><img class="work-image" src="${esc(w.image||'')}" alt="${esc(w.title)}" loading="lazy"><div class="work-fallback"><span>${esc(w.title)}</span></div></div>
      <div class="work-info"><p class="panel__eyebrow">${esc(w.technique||w.category)}</p><h3 class="panel__title">${esc(w.title)}</h3><p class="panel__sub" lang="it">${esc(w.details)}</p><p class="work-desc" lang="it">${esc(w.description)}</p><div><a class="btn btn--ghost" href="${home?'#contatti':'index.html#contatti'}">Inquire</a></div></div>
    </article>`;
  }
  async function load(){
    try{
      const r=await fetch('/data/content.json?v='+Date.now(),{cache:'no-store'});
      if(!r.ok) return;
      const d=await r.json();
      if(document.querySelector('#track')){
        const track=document.querySelector('#track');
        const isHome=location.pathname.endsWith('index.html')||location.pathname.endsWith('/');
        const featured=new Set(d.featuredWorkIds||[]);
        const list=(d.works||[]).filter(w=>w.visible!==false && (!isHome||featured.has(w.id)));
        track.innerHTML=list.map(w=>card(w,isHome)).join('');
      }
      if(d.site){
        const h=document.querySelector('.hero-content h1'); if(h) h.textContent=d.site.homeTitle||h.textContent;
        const hs=document.querySelector('.hero-content .panel__sub--serif'); if(hs) hs.textContent=d.site.homeSubtitle||hs.textContent;
        const an=document.querySelector('.about__name'); if(an) an.textContent=d.site.aboutName||an.textContent;
        const bio=document.querySelector('.about__bio'); if(bio && Array.isArray(d.site.aboutBio)) bio.innerHTML=d.site.aboutBio.map(p=>`<p>${esc(p)}</p>`).join('');
        const email=document.querySelector('#emailText'); if(email) email.textContent=d.site.contactEmail||email.textContent;
      }
      if(Array.isArray(d.aboutSections)) d.aboutSections.forEach(s=>{
        const section=document.getElementById(s.id); if(!section) return;
        const title=section.querySelector('.page-section__title'); if(title) title.textContent=s.title;
        const prose=section.querySelector('.prose'); if(prose && typeof s.html==='string') prose.innerHTML=s.html;
      });
    }catch(e){ console.warn('CMS: impossibile caricare i contenuti',e); }
  }
  window.CMS_READY=load();
})();
