const $ = selector => document.querySelector(selector);
const dialog = $('#dialog');
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const priorityClass = priority => `tag ${priority}`;

async function load() {
  const [summary, items] = await Promise.all([fetch('/api/overview').then(r => r.json()), fetch('/api/work-items').then(r => r.json())]);
  ['total', 'active', 'blocked'].forEach(key => { $(`#${key}`).textContent = summary[key]; });
  $('#items').innerHTML = items.length ? items.map(item => `<article class="item"><div class="icon">${item.title[0].toUpperCase()}</div><div class="item-main"><h3>${escapeHtml(item.title)}</h3><p>Owner: ${escapeHtml(item.owner)} · ${new Date(item.created_at).toLocaleDateString()}</p></div><span class="state ${item.state}">${item.state}</span><span class="${priorityClass(item.priority)}">${item.priority}</span></article>`).join('') : '<p class="loading">No work items yet. Create one to generate your first trace.</p>';
}

$('#open-form').onclick = () => { $('#form-message').textContent = ''; dialog.showModal(); };
$('#submit').onclick = async event => {
  event.preventDefault(); const title = $('#title').value.trim(); const owner = $('#owner').value.trim() || 'Unassigned'; const priority = $('#priority').value;
  if (title.length < 3) return $('#form-message').textContent = 'Please enter a longer title.';
  $('#submit').disabled = true; $('#form-message').textContent = 'Creating item…';
  try { const r = await fetch('/api/work-items', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title, owner, priority}) }); if (!r.ok) throw new Error('Request failed'); dialog.close(); $('#title').value = ''; $('#owner').value = ''; await load(); }
  catch { $('#form-message').textContent = 'Could not create the item.'; }
  finally { $('#submit').disabled = false; }
};
load().catch(() => { $('#items').innerHTML = '<p class="loading">The service is unavailable. Check the database connection.</p>'; });
