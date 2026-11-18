(() => {
  const $ = s => document.querySelector(s);
  let data = null, activeWorkId = null, dirty = false, cfg = null;
  const loginScreen=$('#loginScreen'), app=$('#app');
  const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); };
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ghHeaders = () => ({'Accept':'application/vnd.github+json','Authorization':'Bearer '+cfg.token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'});
  const apiUrl = path => `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(cfg.branch)}`;
  async function gh(path, options={}) {
    const r=await fetch(apiUrl(path),{...options,headers:{...ghHeaders(),...(options.headers||{})}});
    const body=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(body.message||`GitHub API: ${r.status}`);
    return body;
  }
  const markDirty = () => { dirty=true; $('#saveStatus').textContent='● Modifiche da pubblicare'; $('#saveStatus').style.color='#d9bd8a'; };
  const setClean = () => { dirty=false; $('#saveStatus').textContent='● Salvato su GitHub'; $('#saveStatus').style.color='var(--green)'; };
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function showPage(name){ document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden',p.id!=='page-'+name)); document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===name)); $('#pageName').textContent=({overview:'Panoramica',works:'Artworks',home:'Home',about:'About',settings:'Impostazioni'})[name]; }
  function refreshStats(){ $('#worksCount').textContent=data.works.length; $('#statWorks').textContent=data.works.length; $('#statSections').textContent=data.aboutSections.length; }
  function renderWorks(filter=''){
    const list=$('#worksList'),q=filter.toLowerCase();
    const works=data.works.filter(w=>(w.title+' '+w.category).toLowerCase().includes(q));
    $('#workListCount').textContent=works.length+' opere';
    list.innerHTML=works.map(w=>`<div class="work-row ${activeWorkId===w.id?'active':''}" data-id="${esc(w.id)}">${w.image?`<img src="${esc(w.image)}" alt="">`:'<div class="placeholder-img">▧</div>'}<div><b>${esc(w.title)}</b><small>${esc(w.technique||w.category)}</small></div><span class="row-state">${w.visible===false?'BOZZA':'ONLINE'}</span></div>`).join('')||'<div class="empty-editor">Nessuna opera trovata.</div>';
    list.querySelectorAll('.work-row').forEach(row=>row.addEventListener('click',()=>editWork(row.dataset.id)));
  }
  function editWork(id){
    activeWorkId=id; const w=data.works.find(x=>x.id===id); if(!w)return; renderWorks($('#workSearch').value);
    $('#workEditor').innerHTML=`<div class="panel-head"><div><div class="eyebrow">ARTWORK EDITOR</div><h2>Modifica opera</h2></div><button class="secondary" id="closeEditor">Chiudi</button></div>
      <label>Titolo<input id="wTitle" value="${esc(w.title)}"></label>
      <div class="form-grid"><label>Categoria<select id="wCategory"><option value="olio">Olio</option><option value="grafite">Grafite</option><option value="aerografo">Aerografo</option><option value="pigmenti">Pigmenti</option><option value="altro">Altro</option></select></label><label>Tecnica / Etichetta<input id="wTechnique" value="${esc(w.technique)}"></label></div>
      <label>Dettagli tecnici<input id="wDetails" value="${esc(w.details)}" placeholder="Olio su tela — 120 x 140 cm"></label>
      <label>Descrizione<textarea id="wDescription" rows="3">${esc(w.description)}</textarea></label>
      <label>Immagine (percorso o URL)<input id="wImage" value="${esc(w.image)}" placeholder="Images/nome-opera.webp"></label>
      <label>Carica una nuova immagine<input id="wUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
      ${w.image?`<img class="image-preview" id="imagePreview" src="${esc(w.image)}" alt="Anteprima">`:'<div id="imagePreview" class="image-preview" style="display:grid;place-items:center;color:#777">Nessuna immagine</div>'}
      <label class="checkbox-line"><input type="checkbox" id="wFeatured" ${data.featuredWorkIds.includes(w.id)?'checked':''}> Mostra anche nella Home (opere in evidenza)</label>
      <label class="checkbox-line"><input type="checkbox" id="wVisible" ${w.visible!==false?'checked':''}> Pubblicata nella pagina Artworks</label>
      <div class="editor-actions"><button class="danger" id="deleteWork">Elimina opera</button><button class="primary" id="applyWork">Applica modifiche</button></div>`;
    $('#wCategory').value=w.category||'olio';
    $('#closeEditor').onclick=()=>{$('#workEditor').innerHTML='<div class="empty-editor"><span>▧</span><h3>Seleziona un\'opera</h3><p>Scegli un elemento dalla lista oppure creane uno nuovo.</p></div>';activeWorkId=null;renderWorks($('#workSearch').value);};
    $('#wImage').addEventListener('input',()=>{const p=$('#imagePreview');p.outerHTML=`<img class="image-preview" id="imagePreview" src="${esc($('#wImage').value)}" alt="Anteprima">`;});
    $('#wUpload').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){toast('Immagine troppo grande (max 8 MB)');return;}try{toast('Caricamento immagine su GitHub...');const b64=await fileToBase64(file);const safe=file.name.normalize('NFD').replace(/[^a-zA-Z0-9._-]/g,'-');const path=`public/uploads/${Date.now()}-${safe}`;await putFile(path,b64,`CMS: carica immagine ${safe}`);const url=`/uploads/${encodeURIComponent(path.split('/').pop())}`;$('#wImage').value=url;$('#imagePreview').src=url;toast('Immagine caricata su GitHub');markDirty();}catch(err){toast(err.message);}});
    $('#applyWork').onclick=()=>{w.title=$('#wTitle').value.trim()||'Senza titolo';w.category=$('#wCategory').value;w.technique=$('#wTechnique').value;w.details=$('#wDetails').value;w.description=$('#wDescription').value;w.image=$('#wImage').value;w.visible=$('#wVisible').checked;const featured=data.featuredWorkIds.includes(w.id);if($('#wFeatured').checked&&!featured)data.featuredWorkIds.push(w.id);if(!$('#wFeatured').checked&&featured)data.featuredWorkIds=data.featuredWorkIds.filter(x=>x!==w.id);markDirty();renderWorks($('#workSearch').value);toast('Opera aggiornata. Premi Pubblica.');};
    $('#deleteWork').onclick=()=>{if(!confirm('Eliminare definitivamente questa opera?'))return;data.works=data.works.filter(x=>x.id!==w.id);data.featuredWorkIds=data.featuredWorkIds.filter(x=>x!==w.id);activeWorkId=null;$('#workEditor').innerHTML='<div class="empty-editor"><span>▧</span><h3>Opera eliminata</h3></div>';markDirty();renderWorks($('#workSearch').value);refreshStats();};
  }
  function newWork(){const id='work-'+slug('nuova-opera-'+Date.now());const w={id,title:'Nuova opera',category:'olio',technique:'Olio',details:'',description:'',image:'',featured:false,visible:true};data.works.unshift(w);activeWorkId=id;renderWorks($('#workSearch').value);editWork(id);markDirty();}
  function fillForms(){
    $('#homeTitle').value=data.site.homeTitle||'';$('#homeSubtitle').value=data.site.homeSubtitle||'';$('#contactEmail').value=data.site.contactEmail||'';
    $('#aboutName').value=data.site.aboutName||'';$('#aboutBio').value=(data.site.aboutBio||[]).join('\n\n');
    $('#aboutSections').innerHTML=data.aboutSections.map((s,i)=>`<div class="section-edit"><b>${esc(s.title)}</b><label>Titolo<input data-section-title="${i}" value="${esc(s.title)}"></label><label>Contenuto editoriale<div class="rich-editor" contenteditable="true" data-section-html="${i}">${s.html||''}</div></label></div>`).join('');
    document.querySelectorAll('#page-home input,#page-about input,#page-about textarea,#page-about [contenteditable=true]').forEach(el=>el.addEventListener('input',markDirty));
  }
  function collectForms(){data.site.homeTitle=$('#homeTitle').value;data.site.homeSubtitle=$('#homeSubtitle').value;data.site.contactEmail=$('#contactEmail').value;data.site.aboutName=$('#aboutName').value;data.site.aboutBio=$('#aboutBio').value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);data.aboutSections.forEach((s,i)=>{s.title=document.querySelector(`[data-section-title="${i}"]`).value;s.html=document.querySelector(`[data-section-html="${i}"]`).innerHTML;});}
  function utf8Base64(str){return btoa(unescape(encodeURIComponent(str)));}
  function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});}
  async function putFile(path,content,message){let sha;try{const old=await gh(path);sha=old.sha;}catch(e){if(!String(e.message).includes('Not Found'))throw e;}const body={message,content,branch:cfg.branch};if(sha)body.sha=sha;return gh(path,{method:'PUT',body:JSON.stringify(body)});}
  async function save(){collectForms();$('#saveBtn').disabled=true;$('#saveBtn').textContent='Pubblicazione...';try{await putFile('public/data/content.json',utf8Base64(JSON.stringify(data,null,2)),'CMS: aggiorna contenuti sito');setClean();toast('Contenuti salvati su GitHub. Cloudflare avvierà il deploy.');}catch(e){toast('Errore pubblicazione: '+e.message);}finally{$('#saveBtn').disabled=false;$('#saveBtn').innerHTML='Pubblica modifiche <span>↗</span>';}}
  async function connect(){cfg={owner:$('#ghOwner').value.trim(),repo:$('#ghRepo').value.trim(),branch:$('#ghBranch').value.trim()||'main',token:$('#ghToken').value.trim()};if(!cfg.owner||!cfg.repo||!cfg.token)throw new Error('Compila tutti i campi.');sessionStorage.setItem('enricoCmsConfig',JSON.stringify(cfg));const file=await gh('public/data/content.json');const raw=atob(file.content.replace(/\n/g,''));data=JSON.parse(decodeURIComponent(escape(raw)));loginScreen.classList.add('hidden');app.classList.remove('hidden');refreshStats();fillForms();renderWorks();setClean();}
  async function start(){try{const saved=sessionStorage.getItem('enricoCmsConfig');if(!saved)return;cfg=JSON.parse(saved);const file=await gh('public/data/content.json');const raw=atob(file.content.replace(/\n/g,''));data=JSON.parse(decodeURIComponent(escape(raw)));loginScreen.classList.add('hidden');app.classList.remove('hidden');refreshStats();fillForms();renderWorks();setClean();}catch(e){sessionStorage.removeItem('enricoCmsConfig');loginScreen.classList.remove('hidden');app.classList.add('hidden');$('#loginError').textContent='Connessione non riuscita: '+e.message;}}
  $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{await connect();}catch(err){sessionStorage.removeItem('enricoCmsConfig');$('#loginError').textContent=err.message;}});
  $('#logoutBtn').onclick=()=>{if(dirty&&!confirm('Ci sono modifiche non pubblicate. Uscire comunque?'))return;sessionStorage.removeItem('enricoCmsConfig');location.reload();};
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
  $('#saveBtn').onclick=save;$('#newWorkBtn').onclick=newWork;$('#workSearch').addEventListener('input',e=>renderWorks(e.target.value));
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  start();
})();
