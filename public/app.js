const $ = selector => document.querySelector(selector);
const dialog = $('#dialog');
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const copy = {
  overview: ['Execution at a glance', 'A deliberately small workflow that produces real HTTP, custom business, and PostgreSQL trace spans.'],
  'work-items': ['Work items', 'Review every item stored in the PostgreSQL workspace.'],
  activity: ['Activity', 'A database-backed timeline of work created through PulseDesk.']
};
function renderItems(items, target, limit) {
  const visible = limit ? items.slice(0, limit) : items;
  $(target).innerHTML = visible.length ? visible.map(item => `<article class="item"><div class="icon">${escapeHtml(item.title[0].toUpperCase())}</div><div class="item-main"><h3>${escapeHtml(item.title)}</h3><p>Owner: ${escapeHtml(item.owner)} · ${new Date(item.created_at).toLocaleDateString()}</p></div><span class="state ${item.state}">${item.state}</span><span class="tag ${item.priority}">${item.priority}</span></article>`).join('') : '<p class="loading">No work items yet. Create one to generate your first trace.</p>';
}
async function asJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${url} failed`); return response.json(); }
async function load() {
  const [summary, items, activity] = await Promise.all([asJson('/api/overview'), asJson('/api/work-items'), asJson('/api/activity')]);
  ['total', 'active', 'blocked'].forEach(key => { $(`#${key}`).textContent = summary[key]; });
  renderItems(items, '#recent-items', 5); renderItems(items, '#all-items'); $('#work-count').textContent = `${items.length} items`;
  $('#activity-feed').innerHTML = activity.length ? activity.map(event => `<article class="activity-event"><div class="activity-dot"></div><div><h3>${escapeHtml(event.message)}</h3><p>${escapeHtml(event.owner)} · ${new Date(event.created_at).toLocaleString()} · <span class="state ${event.state}">${event.state}</span></p></div></article>`).join('') : '<p class="loading">No activity yet.</p>';
}
function showView(view) {
  document.querySelectorAll('[data-view-panel]').forEach(panel => { panel.hidden = panel.dataset.viewPanel !== view; });
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#page-title').textContent = copy[view][0]; $('#page-lede').textContent = copy[view][1];
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => showView(button.dataset.view));
$('#open-form').onclick = () => { $('#form-message').textContent = ''; dialog.showModal(); };
$('#submit').onclick = async event => {
  event.preventDefault(); const title = $('#title').value.trim(); const owner = $('#owner').value.trim() || 'Unassigned'; const priority = $('#priority').value;
  if (title.length < 3) return $('#form-message').textContent = 'Please enter a longer title.';
  $('#submit').disabled = true; $('#form-message').textContent = 'Creating item…';
  try { const r = await fetch('/api/work-items', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title, owner, priority}) }); if (!r.ok) throw new Error('Request failed'); dialog.close(); $('#title').value = ''; $('#owner').value = ''; await load(); }
  catch { $('#form-message').textContent = 'Could not create the item.'; }
  finally { $('#submit').disabled = false; }
};
load().catch(() => { ['#recent-items', '#all-items', '#activity-feed'].forEach(target => { $(target).innerHTML = '<p class="loading">The service is unavailable. Check the database connection.</p>'; }); });
