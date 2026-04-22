// Blog Admin SPA v2 — Cookie auth, DESIGN.md compliant
// All fetch() calls use credentials:"same-origin" — browser sends httpOnly cookies automatically
'use strict';
var cv='dashboard', cu=null, cp=1, ps=20;

/* ══════════════════════════════════════
   BOOT — auth check
   ══════════════════════════════════════ */
(function boot(){
  fetch('/api/admin/auth/me',{credentials:'same-origin'})
    .then(function(r){
      if(r.ok) return r.json();
      // Auth failed — try refreshing the token before giving up
      return fetch('/api/admin/auth/refresh',{method:'POST',credentials:'same-origin'})
        .then(function(rr){
          if(rr.ok) return fetch('/api/admin/auth/me',{credentials:'same-origin'}).then(function(r3){return r3.ok?r3.json():null});
          return null;
        })
        .catch(function(){return null});
    })
    .then(function(d){
      if(!d||!d.user){
        // Not authenticated — show inline login prompt instead of redirect loop
        document.getElementById('appContent').innerHTML =
          '<div class="empty-state" style="margin-top:80px">'+
            '<div class="empty-icon">🔒</div>'+
            '<div class="empty-title">Session Expired</div>'+
            '<div class="empty-desc">Your session has expired or could not be verified. Please sign in again.</div>'+
            '<a href="/admin/login" class="btn btn-primary" style="margin-top:16px">Sign In</a>'+
          '</div>';
        return;
      }
      cu = d.user;
      // Populate user info
      var initials = (cu.name||cu.email).charAt(0).toUpperCase();
      var el = function(id){ return document.getElementById(id); };
      el('userName').textContent  = cu.name || cu.email.split('@')[0];
      el('userAvatar').textContent = initials;
      el('userRole').textContent  = cu.role;
      var nu = el('nav-users');
      if(cu.role==='admin' && nu) nu.classList.remove('hidden');
      // Wire nav
      document.querySelectorAll('.nav-item[data-view]').forEach(function(n){
        n.addEventListener('click', function(){ nav(n.dataset.view); });
      });
      el('logoutBtn').addEventListener('click', logout);
      // Load initial view from hash or default
      var h = window.location.hash.slice(1);
      nav(h || 'dashboard', true);
      // Listen for hash changes
      window.addEventListener('hashchange', function(){
        var h2 = window.location.hash.slice(1);
        if(h2 && h2!==cv) nav(h2, true);
      });
    })
    .catch(function(err){
      // Network error or JSON parsing error — don't redirect, show error instead
      console.error('[Admin] Boot error:', err);
      var msg = err && err.message ? err.message : 'Could not reach the server.';
      var diag = '';
      if (msg.indexOf('Unexpected token') >= 0) {
        diag = 'The server returned an invalid response (HTML instead of JSON). This usually means the Cloudflare Pages Function failed to execute or the path is returning a 404 page.';
      }
      document.getElementById('appContent').innerHTML =
        '<div class="empty-state" style="margin-top:60px">'+
          '<div class="empty-icon">⚠️</div>'+
          '<div class="empty-title">Connection Error</div>'+
          '<div class="empty-desc" style="margin-bottom:12px">' + esc(msg) + '</div>'+
          (diag ? '<div class="text-xs text-muted" style="max-width:400px;margin:0 auto 20px;padding:12px;background:var(--surface-hover);border:1px solid var(--border);border-radius:var(--radius-md);text-align:left;">' +
            '<strong>Diagnostics:</strong><br/>' + esc(diag) + 
            '<br/><br/><strong>Next steps:</strong><br/>1. Check if the domain is correctly configured in Cloudflare.<br/>2. Visit <a href="/api/admin/health" target="_blank" style="color:var(--accent)">/api/admin/health</a> to check system status.</div>' : '') +
          '<button class="btn btn-primary" onclick="location.reload()">Retry</button>'+
        '</div>';
    });
})();

/* ══════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════ */
function nav(view, noHash){
  cv=view; cp=1;
  if(!noHash) window.location.hash = view;
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var ni = document.getElementById('nav-'+view);
  if(ni) ni.classList.add('active');
  var labels = {dashboard:'Dashboard',articles:'Articles',comments:'Comments',
                subscribers:'Subscribers',files:'Files',users:'Users',settings:'Settings'};
  var bc = document.getElementById('breadcrumbCurrent');
  if(bc) bc.textContent = labels[view]||view;
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  // Render
  var app = document.getElementById('appContent');
  app.innerHTML = '<div class="loading-state"><div class="spinner"></div><span class="text-sm text-muted">Loading...</span></div>';
  var views = {dashboard:vDashboard,articles:vArticles,comments:vComments,
               subscribers:vSubscribers,files:vFiles,users:vUsers,settings:vSettings};
  if(views[view]) views[view]();
}

/* ══════════════════════════════════════
   API HELPER
   ══════════════════════════════════════ */
function showLoading(show) {
  var bar = document.getElementById('loadingBar');
  if (!bar) return;
  if (show) {
    bar.style.transform = 'translateX(0)';
    bar.style.opacity = '1';
  } else {
    bar.style.transform = 'translateX(100%)';
    bar.style.opacity = '0';
    setTimeout(function(){ bar.style.transform = 'translateX(-100%)'; }, 300);
  }
}

async function api(url, opts){
  showLoading(true);
  var options = Object.assign({credentials:'same-origin'}, opts||{});
  if(!options.headers) options.headers = {};
  if(!options.headers['Content-Type'] && options.method && options.method!=='GET'){
    options.headers['Content-Type'] = 'application/json';
  }
  var res;
  try{ res = await fetch(url, options); }
  catch(e){ 
    showLoading(false);
    toast('Network error','error'); 
    return {ok:false,status:0,data:{}}; 
  }
  var data = {};
  try{ data = await res.json(); }catch(e){}
  showLoading(false);
  if(res.status===401){
    toast('Session expired — please sign in again','error');
    // Don't auto-redirect: show link instead
    document.getElementById('appContent').innerHTML =
      '<div class="empty-state" style="margin-top:60px">'+
        '<div class="empty-icon">🔒</div>'+
        '<div class="empty-title">Session Expired</div>'+
        '<div class="empty-desc">Please sign in again to continue.</div>'+
        '<a href="/admin/login" class="btn btn-primary" style="margin-top:16px">Sign In</a>'+
      '</div>';
  } else if(!res.ok && res.status!==404){
    toast(data.error||'Request failed ('+res.status+')','error');
  }
  return {ok:res.ok, status:res.status, data:data};
}

/* ══════════════════════════════════════
   TOAST
   ══════════════════════════════════════ */
function toast(msg, type){
  type = type||'info';
  var icons = {success:'✓', error:'✕', info:'ℹ'};
  var stack = document.getElementById('toastStack');
  var el = document.createElement('div');
  el.className = 'toast toast-'+type;
  el.innerHTML = '<span class="toast-icon">'+icons[type]+'</span><span>'+esc(msg)+'</span>';
  stack.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transform='translateX(16px)'; el.style.transition='all .3s'; setTimeout(function(){ el.remove(); },300); }, 3000);
}

/* ══════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════ */
async function logout(){
  await api('/api/admin/auth/logout',{method:'POST'});
  window.location.href='/admin/login';
}

/* ══════════════════════════════════════
   MODAL HELPERS
   ══════════════════════════════════════ */
function openModal(html){
  var mc = document.getElementById('modalContainer');
  mc.innerHTML = html;
  mc.querySelector('.modal-overlay').addEventListener('click', function(e){
    if(e.target===this) closeModal();
  });
}
function closeModal(){
  document.getElementById('modalContainer').innerHTML='';
}

/* ══════════════════════════════════════
   VIEW: DASHBOARD
   ══════════════════════════════════════ */
async function vDashboard(){
  var r = await api('/api/admin/stats');
  if(!r.ok) return;
  var o  = r.data.overview||{};
  var ta = r.data.topArticles||[];
  var rc = r.data.recentComments||[];
  var vt = r.data.viewsTrend||[];

  // Update pending badge
  if((o.pendingComments||0)>0){
    var b = document.getElementById('badge-comments');
    if(b){ b.textContent=o.pendingComments; b.classList.remove('hidden'); }
  }

  // Trend bars
  var tMax = Math.max.apply(Math, vt.map(function(d){ return Number(d.views)||0; }))||1;
  var bars = vt.map(function(d,i){
    var h = Math.max(4, Math.round((Number(d.views)||0)/tMax*100));
    var label = d.date ? d.date.slice(5) : '';
    return '<div style="flex:1;height:'+h+'%;background:var(--accent);border-radius:2px 2px 0 0;min-width:12px;position:relative;transition:all .3s var(--ease)" title="'+esc(d.date)+': '+d.views+' views"></div>';
  }).join('');

  document.getElementById('appContent').innerHTML =
    '<div class="page-header">'+
      '<div class="page-eyebrow">Overview</div>'+
      '<h1 class="page-title">Dashboard</h1>'+
      '<p class="page-desc">Welcome back, '+esc(cu.name||cu.email.split('@')[0])+'</p>'+
    '</div>'+

    // Stat cards
    '<div class="stats-grid">'+
      statCard('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>','accent',(o.totalViews||0).toLocaleString(),'Total Views','All time page views')+
      statCard('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>','info',o.totalArticles||0,'Articles','Published posts')+
      statCard('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>','warning',o.totalComments||0,'Comments',(o.pendingComments||0)>0?'<span class="badge badge-warning" style="margin-left:6px">'+o.pendingComments+' pending</span>':'')+
      statCard('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>','success',o.totalSubscribers||0,'Subscribers',(o.confirmedSubscribers||0)+' confirmed')+
    '</div>'+

    '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:24px;margin-bottom:24px">'+
      '<div class="card">'+
        '<div class="card-header"><div class="card-title">Views Trend (Last 7 days)</div></div>'+
        '<div class="card-body" style="padding:24px">'+
          '<div class="trend-chart" style="height:120px;display:flex;align-items:flex-end;gap:8px">'+(bars||'<div class="text-sm text-muted">No data yet</div>')+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="card">'+
        '<div class="card-header"><div class="card-title">Top Articles</div></div>'+
        '<div class="card-body">'+
          (ta.length ? '<div class="table-wrap"><table><tbody>'+ta.map(function(a,i){
            return '<tr>'+
              '<td style="width:40px"><span class="badge badge-default mono">'+(i+1)+'</span></td>'+
              '<td><div class="font-medium truncate" style="max-width:200px">'+esc(a.slug)+'</div></td>'+
              '<td style="text-align:right"><span class="mono font-semibold text-accent">'+a.count+'</span></td>'+
            '</tr>';
          }).join('')+'</tbody></table></div>' : '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-desc">No views yet</div></div>')+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="card">'+
      '<div class="card-header">'+
        '<div class="card-title">Recent Comments</div>'+
        '<button class="btn btn-ghost btn-sm" onclick="nav(\'comments\')">View all</button>'+
      '</div>'+
      '<div class="card-body">'+
        (rc.length ? '<div class="table-wrap"><table><tbody>'+rc.map(function(c){
          return '<tr>'+
            '<td style="width:48px">'+
              '<div style="width:32px;height:32px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--text-secondary)">'+(c.author||'A').charAt(0).toUpperCase()+'</div>'+
            '</td>'+
            '<td>'+
              '<div class="flex items-center gap-2 mb-1">'+
                '<span class="font-semibold">'+esc(c.author)+'</span>'+
                '<span class="text-xs text-muted">'+fmtDate(c.created_at)+'</span>'+
                (c.is_visible?'':'<span class="badge badge-warning">Hidden</span>')+
              '</div>'+
              '<div class="text-sm text-secondary truncate" style="max-width:400px">'+esc(c.content)+'</div>'+
              '<div class="text-xs text-muted mt-1">on <a href="/blog/'+esc(c.slug)+'" target="_blank" class="text-accent">/'+esc(c.slug)+'</a></div>'+
            '</td>'+
            '<td style="text-align:right">'+
              '<button class="btn btn-ghost btn-sm" onclick="toggleComment('+c.id+','+(c.is_visible?1:0)+')">'+(c.is_visible?'Hide':'Show')+'</button>'+
            '</td>'+
          '</tr>';
        }).join('')+'</tbody></table></div>' : '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-desc">No comments yet</div></div>')+
      '</div>'+
    '</div>';
}

function statCard(icon, color, value, label, sub){
  return '<div class="stat-card">'+
    '<div class="stat-header">'+
      '<div class="stat-icon '+color+'">'+icon+'</div>'+
      (sub?'<div class="stat-trend neutral">'+sub+'</div>':'')+
    '</div>'+
    '<div class="stat-value">'+value+'</div>'+
    '<div class="stat-label">'+label+'</div>'+
  '</div>';
}

/* ══════════════════════════════════════
   VIEW: ARTICLES
   ══════════════════════════════════════ */
async function vArticles(){
  var r = await api('/api/admin/articles');
  if(!r.ok) return;
  var arts = r.data.articles||[];

  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">Content</div>'+
        '<h1 class="page-hd-title">Articles</h1>'+
        '<p class="page-hd-desc">'+arts.length+' articles total</p>'+
      '</div>'+
      '<div class="page-hd-actions">'+
        '<a href="https://github.com/teloei/blog/new/main/src/content/blog" target="_blank" class="btn btn-primary">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          'New Article'+
        '</a>'+
      '</div>'+
    '</div>'+
    '<div class="search-row">'+
      '<div class="search-wrap">'+
        '<span class="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>'+
        '<input class="input search-input" placeholder="Search articles..." id="artSearch" oninput="filterArts(this.value)"/>'+
      '</div>'+
    '</div>'+
    '<div id="artList"></div>';

  renderArtList(arts);
}

function renderArtList(arts){
  var el = document.getElementById('artList');
  if(!arts.length){
    el.innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No articles yet</div><div class="empty-desc">Create your first article on GitHub</div></div>';
    return;
  }
  var rows = arts.map(function(a){
    return '<tr data-search="'+esc(((a.title||'')+(a.slug||'')).toLowerCase())+'">'+
      '<td>'+
        '<div class="font-semibold" style="color:var(--charcoal)">'+esc(a.title||a.slug)+'</div>'+
        '<div class="text-xs text-muted mono" style="margin-top:2px">/blog/'+esc(a.slug)+'</div>'+
      '</td>'+
      '<td>'+
        (a.tags||[]).slice(0,3).map(function(t){ return '<span class="badge badge-default" style="margin-right:3px">'+esc(t)+'</span>'; }).join('')+
      '</td>'+
      '<td class="text-sm mono">'+fmtDate(a.pubDate)+'</td>'+
      '<td><span class="mono font-semibold text-terra">'+(a.views||0)+'</span></td>'+
      '<td>'+(a.comments||0)+'</td>'+
      '<td>'+(a.draft?'<span class="badge badge-warning">Draft</span>':'<span class="badge badge-success">Published</span>')+'</td>'+
      '<td>'+
        '<div class="flex gap-2">'+
          '<a href="/blog/'+esc(a.slug)+'" target="_blank" class="btn btn-ghost btn-sm" title="View">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'+
          '</a>'+
          '<a href="https://github.com/teloei/blog/edit/main/src/content/blog/'+esc(a.slug)+'.md" target="_blank" class="btn btn-ghost btn-sm" title="Edit on GitHub">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
          '</a>'+
          '<button class="btn btn-ghost btn-sm" title="Delete data" onclick="delArt(\''+esc(a.slug)+'\')">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
          '</button>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }).join('');
  el.innerHTML =
    '<div class="card"><div class="tbl-wrap"><table>'+
      '<thead><tr>'+
        '<th>Title</th><th>Tags</th><th>Date</th>'+
        '<th>Views</th><th>Comments</th><th>Status</th><th>Actions</th>'+
      '</tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table></div></div>';
}

function filterArts(q){
  var rows = document.querySelectorAll('#artList tbody tr');
  var l = q.toLowerCase();
  rows.forEach(function(r){ r.style.display = r.dataset.search.indexOf(l)>=0?'':'none'; });
}

async function delArt(slug){
  if(!confirm('Clear view/comment data for "'+slug+'"?\n(The .md file must be deleted via GitHub)')) return;
  var r = await api('/api/admin/articles/'+slug,{method:'DELETE'});
  if(r.ok){ toast('Article data cleared','success'); vArticles(); }
}

/* ══════════════════════════════════════
   VIEW: COMMENTS
   ══════════════════════════════════════ */
async function vComments(page){
  cp = page||1;
  var status = (document.getElementById('cmtFilter')||{}).value||'all';
  var r = await api('/api/admin/comments?page='+cp+'&limit='+ps+'&status='+status);
  if(!r.ok) return;
  var cmts = r.data.comments||[], pg = r.data.pagination||{};

  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">Content</div>'+
        '<h1 class="page-hd-title">Comments</h1>'+
        '<p class="page-hd-desc">'+(pg.total||0)+' total</p>'+
      '</div>'+
    '</div>'+
    '<div class="search-row">'+
      '<select class="select" id="cmtFilter" onchange="vComments(1)" style="width:140px">'+
        '<option value="all"'+(status==='all'?' selected':'')+'>All</option>'+
        '<option value="visible"'+(status==='visible'?' selected':'')+'>Visible</option>'+
        '<option value="hidden"'+(status==='hidden'?' selected':'')+'>Hidden</option>'+
      '</select>'+
    '</div>'+
    renderCmtTable(cmts, pg);
}

function renderCmtTable(cmts, pg){
  if(!cmts.length) return '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">No comments found</div></div>';
  var rows = cmts.map(function(c){
    return '<tr>'+
      '<td>'+
        '<div class="font-semibold text-sm">'+esc(c.author)+'</div>'+
        (c.email?'<div class="text-xs text-muted">'+esc(c.email)+'</div>':'')+
      '</td>'+
      '<td style="max-width:300px"><div class="truncate text-sm">'+esc(c.content)+'</div></td>'+
      '<td><a href="/blog/'+esc(c.slug)+'" target="_blank" class="text-sm text-terra">/'+esc(c.slug)+'</a></td>'+
      '<td class="text-sm mono">'+fmtDate(c.created_at)+'</td>'+
      '<td>'+(c.is_visible?'<span class="badge badge-success">Visible</span>':'<span class="badge badge-warning">Hidden</span>')+'</td>'+
      '<td>'+
        '<div class="flex gap-2">'+
          '<button class="btn btn-ghost btn-sm" title="'+(c.is_visible?'Hide':'Show')+'" onclick="toggleComment('+c.id+','+(c.is_visible?1:0)+')">'+
            (c.is_visible?
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>':
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>')+
          '</button>'+
          '<button class="btn btn-ghost btn-sm" title="Delete" onclick="delComment('+c.id+')">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
          '</button>'+
        '</div>'+
      '</td>'+
    '</tr>';
  }).join('');
  return '<div class="card"><div class="tbl-wrap"><table>'+
    '<thead><tr><th>Author</th><th>Content</th><th>Article</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>'+
    '<tbody>'+rows+'</tbody>'+
  '</table></div>'+renderPagination(pg)+'</div>';
}

async function toggleComment(id, vis){
  var r = await api('/api/admin/comments/'+id,{method:'PUT',body:JSON.stringify({is_visible:vis?0:1})});
  if(r.ok){ toast(vis?'Comment hidden':'Comment shown','success'); vComments(cp); }
}
async function delComment(id){
  if(!confirm('Delete this comment permanently?')) return;
  var r = await api('/api/admin/comments/'+id,{method:'DELETE'});
  if(r.ok){ toast('Comment deleted','success'); vComments(cp); }
}

/* ══════════════════════════════════════
   VIEW: SUBSCRIBERS
   ══════════════════════════════════════ */
async function vSubscribers(page){
  cp = page||1;
  var status = (document.getElementById('subFilter')||{}).value||'all';
  var r = await api('/api/admin/subscribers?page='+cp+'&limit='+ps+'&status='+status);
  if(!r.ok) return;
  var subs = r.data.subscribers||[], pg = r.data.pagination||{};

  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">Audience</div>'+
        '<h1 class="page-hd-title">Subscribers</h1>'+
        '<p class="page-hd-desc">'+(pg.total||0)+' total</p>'+
      '</div>'+
    '</div>'+
    '<div class="search-row">'+
      '<select class="select" id="subFilter" onchange="vSubscribers(1)" style="width:160px">'+
        '<option value="all"'+(status==='all'?' selected':'')+'>All</option>'+
        '<option value="confirmed"'+(status==='confirmed'?' selected':'')+'>Confirmed</option>'+
        '<option value="pending"'+(status==='pending'?' selected':'')+'>Pending</option>'+
      '</select>'+
    '</div>'+
    renderSubTable(subs, pg);
}

function renderSubTable(subs, pg){
  if(!subs.length) return '<div class="empty-state"><div class="empty-icon">📧</div><div class="empty-title">No subscribers yet</div><div class="empty-desc">Subscribers will appear here after signing up</div></div>';
  var rows = subs.map(function(s){
    return '<tr>'+
      '<td class="font-medium">'+esc(s.email)+'</td>'+
      '<td>'+(s.confirmed?'<span class="badge badge-success">Confirmed</span>':'<span class="badge badge-warning">Pending</span>')+'</td>'+
      '<td class="text-sm mono">'+fmtDate(s.created_at)+'</td>'+
      '<td>'+
        '<button class="btn btn-ghost btn-sm" title="Remove" onclick="delSub('+s.id+')">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
        '</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  return '<div class="card"><div class="tbl-wrap"><table>'+
    '<thead><tr><th>Email</th><th>Status</th><th>Subscribed</th><th>Actions</th></tr></thead>'+
    '<tbody>'+rows+'</tbody>'+
  '</table></div>'+renderPagination(pg)+'</div>';
}

async function delSub(id){
  if(!confirm('Remove this subscriber?')) return;
  var r = await api('/api/admin/subscribers/'+id,{method:'DELETE'});
  if(r.ok){ toast('Subscriber removed','success'); vSubscribers(cp); }
}

/* ══════════════════════════════════════
   VIEW: FILES
   ══════════════════════════════════════ */
async function vFiles(){
  var r = await api('/api/admin/files?limit=100');
  var files = r.ok ? (r.data.files||[]) : [];
  var icons = {jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',svg:'🖼️',webp:'🖼️',pdf:'📄',mp4:'🎬',webm:'🎬',mp3:'🎵',zip:'📦',json:'📋',txt:'📝'};

  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">System</div>'+
        '<h1 class="page-hd-title">Files</h1>'+
        '<p class="page-hd-desc">'+files.length+' files in R2 bucket</p>'+
      '</div>'+
    '</div>'+
    (!files.length ?
      '<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">No files uploaded</div><div class="empty-desc">Upload images via the blog post editor</div></div>' :
      '<div class="card"><div class="tbl-wrap"><table>'+
        '<thead><tr><th>File</th><th>Size</th><th>Type</th><th>Uploaded</th><th>Actions</th></tr></thead>'+
        '<tbody>'+files.map(function(f){
          var name = f.key.split('/').pop()||'';
          var ext  = (name.split('.').pop()||'').toLowerCase();
          return '<tr>'+
            '<td>'+
              '<div style="display:flex;align-items:center;gap:10px">'+
                '<span style="font-size:20px">'+(icons[ext]||'📄')+'</span>'+
                '<div>'+
                  '<div class="font-medium text-sm truncate" style="max-width:260px">'+esc(name)+'</div>'+
                  '<div class="text-xs text-muted mono">'+esc(f.key)+'</div>'+
                '</div>'+
              '</div>'+
            '</td>'+
            '<td class="text-sm mono">'+fmtBytes(f.size)+'</td>'+
            '<td><span class="badge badge-default">'+esc(ext||'file')+'</span></td>'+
            '<td class="text-sm mono">'+fmtDate(f.uploaded)+'</td>'+
            '<td>'+
              '<div class="flex gap-2">'+
                '<a href="/api/files/'+encodeURIComponent(f.key)+'" target="_blank" class="btn btn-ghost btn-sm" title="Open">'+
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'+
                '</a>'+
                '<button class="btn btn-ghost btn-sm" title="Delete" onclick="delFile(\''+esc(f.key)+'\')">'+
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
                '</button>'+
              '</div>'+
            '</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table></div></div>');
}

async function delFile(key){
  if(!confirm('Delete "'+key+'"?')) return;
  var r = await api('/api/admin/files/'+encodeURIComponent(key),{method:'DELETE'});
  if(r.ok){ toast('File deleted','success'); vFiles(); }
}

/* ══════════════════════════════════════
   VIEW: USERS
   ══════════════════════════════════════ */
async function vUsers(){
  var r = await api('/api/admin/users');
  if(!r.ok) return;
  var users = r.data.users||[];

  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">System</div>'+
        '<h1 class="page-hd-title">Users</h1>'+
        '<p class="page-hd-desc">'+users.length+' admin users</p>'+
      '</div>'+
      '<div class="page-hd-actions">'+
        '<button class="btn btn-primary" onclick="showAddUser()">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
          'Add User'+
        '</button>'+
      '</div>'+
    '</div>'+
    '<div id="uModal"></div>'+
    (!users.length ?
      '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No users</div></div>' :
      '<div class="card"><div class="tbl-wrap"><table>'+
        '<thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>'+
        '<tbody>'+users.map(function(u){
          return '<tr>'+
            '<td>'+
              '<div class="font-semibold">'+esc(u.name||u.email.split('@')[0])+'</div>'+
              '<div class="text-xs text-muted">'+esc(u.email)+'</div>'+
            '</td>'+
            '<td><span class="badge '+(u.role==='admin'?'badge-info':'badge-default')+'">'+u.role+'</span></td>'+
            '<td>'+(u.is_active?'<span class="badge badge-success">Active</span>':'<span class="badge badge-error">Inactive</span>')+'</td>'+
            '<td class="text-sm mono">'+(u.last_login?fmtDate(u.last_login):'<span class="text-muted">Never</span>')+'</td>'+
            '<td class="text-sm mono">'+fmtDate(u.created_at)+'</td>'+
            '<td>'+
              '<div class="flex gap-2">'+
                '<button class="btn btn-ghost btn-sm" onclick="editUser('+u.id+',\''+esc(u.name||'')+'\',\''+esc(u.role)+'\')">'+
                  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
                '</button>'+
                (u.id!==cu.id?
                  '<button class="btn btn-ghost btn-sm" onclick="deleteUser('+u.id+')">'+
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
                  '</button>':'')+
              '</div>'+
            '</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table></div></div>');
}

function showAddUser(){
  openModal(
    '<div class="modal-overlay"><div class="modal">'+
      '<div class="modal-hd"><div class="modal-title">Add User</div><button class="modal-close" onclick="closeModal()">×</button></div>'+
      '<div class="modal-body">'+
        '<div class="form-group"><label class="form-label">Email *</label><input class="input" id="mu-email" type="email" placeholder="user@example.com"/></div>'+
        '<div class="form-group"><label class="form-label">Name</label><input class="input" id="mu-name" placeholder="Display name"/></div>'+
        '<div class="form-group"><label class="form-label">Password *</label><input class="input" id="mu-pass" type="password" placeholder="Min 6 characters"/></div>'+
        '<div class="form-group"><label class="form-label">Role</label><select class="select" id="mu-role"><option value="editor">Editor</option><option value="admin">Admin</option></select></div>'+
      '</div>'+
      '<div class="modal-ft"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="addUser()">Create User</button></div>'+
    '</div></div>'
  );
}

async function addUser(){
  var e=document.getElementById('mu-email').value.trim();
  var n=document.getElementById('mu-name').value.trim();
  var p=document.getElementById('mu-pass').value;
  var role=document.getElementById('mu-role').value;
  if(!e||!p){ toast('Email and password required','error'); return; }
  if(p.length<6){ toast('Password must be at least 6 characters','error'); return; }
  var r = await api('/api/admin/users',{method:'POST',body:JSON.stringify({email:e,name:n,password:p,role:role})});
  if(r.ok){ toast('User created','success'); closeModal(); vUsers(); }
}

function editUser(id, name, role){
  openModal(
    '<div class="modal-overlay"><div class="modal">'+
      '<div class="modal-hd"><div class="modal-title">Edit User</div><button class="modal-close" onclick="closeModal()">×</button></div>'+
      '<div class="modal-body">'+
        '<div class="form-group"><label class="form-label">Name</label><input class="input" id="eu-name" value="'+esc(name)+'"/></div>'+
        '<div class="form-group"><label class="form-label">Role</label><select class="select" id="eu-role"><option value="editor"'+(role==='editor'?' selected':'')+'>Editor</option><option value="admin"'+(role==='admin'?' selected':'')+'>Admin</option></select></div>'+
        '<div class="form-group"><label class="form-label">New Password <span class="text-muted">(leave blank to keep)</span></label><input class="input" id="eu-pass" type="password" placeholder="New password"/></div>'+
      '</div>'+
      '<div class="modal-ft"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveUser('+id+')">Save Changes</button></div>'+
    '</div></div>'
  );
}

async function saveUser(id){
  var body = {name:document.getElementById('eu-name').value.trim(), role:document.getElementById('eu-role').value};
  var p = document.getElementById('eu-pass').value;
  if(p){ if(p.length<6){ toast('Password must be at least 6 characters','error'); return; } body.password=p; }
  var r = await api('/api/admin/users/'+id,{method:'PUT',body:JSON.stringify(body)});
  if(r.ok){ toast('User updated','success'); closeModal(); vUsers(); }
}

async function deleteUser(id){
  if(!confirm('Delete this user? This cannot be undone.')) return;
  var r = await api('/api/admin/users/'+id,{method:'DELETE'});
  if(r.ok){ toast('User deleted','success'); vUsers(); }
}

/* ══════════════════════════════════════
   VIEW: SETTINGS
   ══════════════════════════════════════ */
async function vSettings(){
  document.getElementById('appContent').innerHTML =
    '<div class="page-hd">'+
      '<div class="page-hd-left">'+
        '<div class="page-hd-eyebrow">System</div>'+
        '<h1 class="page-hd-title">Settings</h1>'+
      '</div>'+
    '</div>'+
    '<div style="max-width:560px;display:flex;flex-direction:column;gap:20px">'+

      // Change password
      '<div class="card">'+
        '<div class="card-hd"><div class="card-title">Change Password</div></div>'+
        '<div class="card-body">'+
          '<div class="form-group"><label class="form-label">Current Password</label><input class="input" id="s-cur" type="password"/></div>'+
          '<div class="form-group"><label class="form-label">New Password</label><input class="input" id="s-new" type="password"/></div>'+
          '<div class="form-group"><label class="form-label">Confirm New Password</label><input class="input" id="s-conf" type="password"/></div>'+
          '<button class="btn btn-primary" onclick="changePwd()">Update Password</button>'+
        '</div>'+
      '</div>'+

      // Infrastructure
      '<div class="card">'+
        '<div class="card-hd"><div class="card-title">Infrastructure</div></div>'+
        '<div class="card-body" style="padding:0">'+
          infRow('D1 Database','Connected','success')+
          infRow('R2 Bucket','Connected','success')+
          infRow('Cloudflare Pages','Deployed','success')+
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px">'+
            '<span class="text-sm text-secondary">Blog URL</span>'+
            '<a href="https://blog-brp.pages.dev" target="_blank" class="text-sm text-terra">blog-brp.pages.dev ↗</a>'+
          '</div>'+
        '</div>'+
      '</div>'+

      // Session info
      '<div class="card">'+
        '<div class="card-hd"><div class="card-title">Session</div></div>'+
        '<div class="card-body" style="padding:0">'+
          infRow('Logged in as', esc(cu?cu.email:''), '')+
          infRow('Role', cu?cu.role:'', '')+
          infRow('Auth method', 'httpOnly Cookie', '')+
        '</div>'+
      '</div>'+

    '</div>';
}

function infRow(label, value, badge){
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--w100)">'+
    '<span class="text-sm text-secondary">'+label+'</span>'+
    (badge ? '<span class="badge badge-'+badge+'">'+value+'</span>' : '<span class="text-sm font-medium">'+value+'</span>')+
  '</div>';
}

async function changePwd(){
  var cur=document.getElementById('s-cur').value;
  var neu=document.getElementById('s-new').value;
  var conf=document.getElementById('s-conf').value;
  if(!cur||!neu||!conf){ toast('Fill all fields','error'); return; }
  if(neu!==conf){ toast('Passwords do not match','error'); return; }
  if(neu.length<6){ toast('Min 6 characters','error'); return; }
  // Verify current password
  var lr = await fetch('/api/admin/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email:cu.email,password:cur})});
  if(!lr.ok){ toast('Current password is incorrect','error'); return; }
  var r = await api('/api/admin/users/'+cu.id,{method:'PUT',body:JSON.stringify({password:neu})});
  if(r.ok){
    toast('Password updated successfully','success');
    ['s-cur','s-new','s-conf'].forEach(function(id){ document.getElementById(id).value=''; });
  }
}

/* ══════════════════════════════════════
   PAGINATION
   ══════════════════════════════════════ */
function renderPagination(pg){
  if(!pg||pg.totalPages<=1) return '';
  var btns = '';
  for(var i=1;i<=pg.totalPages;i++){
    btns += '<button class="page-btn'+(i===pg.page?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
  }
  return '<div class="pagination">'+
    '<button class="page-btn" onclick="goPage('+(pg.page-1)+')" '+(pg.page<=1?'disabled':'')+'>‹ Prev</button>'+
    btns+
    '<button class="page-btn" onclick="goPage('+(pg.page+1)+')" '+(pg.page>=pg.totalPages?'disabled':'')+'>Next ›</button>'+
  '</div>';
}

function goPage(page){
  if(page<1) return;
  if(cv==='comments') vComments(page);
  else if(cv==='subscribers') vSubscribers(page);
}

/* ══════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════ */
function fmtDate(d){
  if(!d) return '—';
  var dt = new Date(d);
  if(isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
}

function fmtBytes(b){
  if(!b) return '0 B';
  var k=1024, s=['B','KB','MB','GB'];
  var i=Math.floor(Math.log(b)/Math.log(k));
  return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i];
}

function esc(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
