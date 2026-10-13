import http from 'node:http';
import crypto from 'node:crypto';
import { URLSearchParams } from 'node:url';

const PORT = process.env.PORT || 3000;
const USER = process.env.DEMO_USER || 'demo@lumendocs.test';
const PASS = process.env.DEMO_PASS || 'lumen-demo-2026';
const sessions = new Set();
const state = { brand: 'orange', theme: 'light', kbName: 'Lumen Help Center', domain: '', articles: [
  { id: 1, title: 'Getting started with Lumen', status: 'published' },
  { id: 2, title: 'Inviting your team', status: 'published' },
  { id: 3, title: 'Custom domains', status: 'draft' },
], members: [['Ada Lovelace', 'Admin'], ['Grace Hopper', 'Member']], plan: 'Free' };

const nav = [['/dashboard', 'Dashboard'], ['/articles', 'Knowledge Hub'], ['/analytics', 'Analytics'], ['/customize/general', 'Customize'], ['/settings/billing', 'Billing'], ['/settings/members', 'Members']];
const tabs = [['general', 'General'], ['theme', 'Theme & Styling'], ['domains', 'Domains & Redirects'], ['seo', 'SEO']];

const layout = (title, body, path) => `<!doctype html><html data-theme="${state.theme}"><head><meta charset="utf-8"><title>${title} · Lumen Docs</title>
<style>:root{--brand:${state.brand};--bg:#fff;--fg:#111;--side:#f5f5f5}[data-theme=dark]{--bg:#111;--fg:#eee;--side:#1c1c1c}
body{margin:0;font:15px system-ui;background:var(--bg);color:var(--fg);display:flex;min-height:100vh}
aside{width:220px;background:var(--side);padding:20px;box-sizing:border-box;display:flex;flex-direction:column}aside a{display:block;padding:8px 10px;color:inherit;text-decoration:none;border-radius:6px}aside a.on{background:var(--brand);color:#fff}
main{flex:1;padding:32px;max-width:860px}h1{margin-top:0}button,.btn{background:var(--brand);color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer;text-decoration:none}
input,select,textarea{padding:7px;border:1px solid #999;border-radius:6px;background:var(--bg);color:var(--fg)}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}
.tabs a{margin-right:16px;color:inherit}.tabs a.on{font-weight:700;border-bottom:2px solid var(--brand)}.err{color:#c00}.card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0}.footer{margin-top:auto;font-size:13px}</style></head>
<body><aside><strong>Lumen Docs</strong><p><small>${state.kbName}</small></p>${nav.map(([h, l]) => `<a href="${h}" class="${path.startsWith(h.split('/').slice(0, 2).join('/')) ? 'on' : ''}">${l}</a>`).join('')}
<form method="post" action="/theme" class="footer"><button type="submit">${state.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}</button></form><p><a href="/logout">Sign out</a></p></aside><main>${body}</main></body></html>`;

const customize = (tab, inner) => `<h1>Customize</h1><p class="tabs">${tabs.map(([k, l]) => `<a href="/customize/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</p>${inner}`;

const pages = {
  '/dashboard': () => `<h1>Welcome back</h1><div class="card">${state.articles.filter((a) => a.status === 'published').length} published articles, ${state.members.length} members, plan: ${state.plan}.</div><p>Use the sidebar to manage your knowledge base.</p>`,
  '/articles': () => `<h1>Knowledge Hub</h1><a class="btn" href="/articles/new">Add article</a><table><tr><th>Title</th><th>Status</th><th></th></tr>${state.articles.map((a) => `<tr><td>${a.title}</td><td>${a.status}</td><td><form method="post" action="/articles/${a.id}/toggle" style="display:inline"><button>${a.status === 'published' ? 'Unpublish' : 'Publish'}</button></form></td></tr>`).join('')}</table>`,
  '/articles/new': () => `<h1>New article</h1><form method="post" action="/articles"><p><input name="title" placeholder="Article title" required></p><p><textarea name="body" rows="6" cols="60" placeholder="Write something"></textarea></p><button>Save draft</button></form>`,
  '/analytics': () => `<h1>Analytics</h1><div class="card">Unique viewers: 1,204<br>Searches: 312<br>Top article: Getting started with Lumen</div>`,
  '/customize/general': () => customize('general', `<form method="post" action="/customize/general"><p>Knowledge base name<br><input name="kbName" value="${state.kbName}"></p><button>Save</button></form>`),
  '/customize/theme': () => customize('theme', `<form method="post" action="/customize/theme"><p>Brand color<br><select name="brand">${['orange', 'blue', 'green', 'purple'].map((c) => `<option ${c === state.brand ? 'selected' : ''}>${c}</option>`).join('')}</select></p><p>Default theme<br><select name="theme"><option ${state.theme === 'light' ? 'selected' : ''}>light</option><option ${state.theme === 'dark' ? 'selected' : ''}>dark</option></select></p><button>Save</button></form>`),
  '/customize/domains': (q) => customize('domains', `<form method="post" action="/customize/domains"><p>Custom domain<br><input name="domain" value="${state.domain}" placeholder="help.example.com"> <button>Add</button></p>${q.get('err') ? '<p class="err">Enter a domain like help.example.com</p>' : ''}${state.domain ? `<p>Connected: <strong>${state.domain}</strong>. Add a CNAME record pointing to docs.lumendocs.test. Propagation can take up to 24 hours.</p>` : ''}</form>`),
  '/customize/seo': () => customize('seo', `<form><p>Meta title<br><input value="${state.kbName}"></p><p>Meta description<br><input size="50" value="Help articles for Lumen customers"></p><button type="button">Save</button></form>`),
  '/settings/billing': () => `<h1>Billing</h1><div class="card">Current plan: <strong>${state.plan}</strong>. Billed on the 1st of each month. Upgrades are prorated on the next invoice.</div><p>Pro is $29 per editor per month. <button>Upgrade to Pro</button></p>`,
  '/settings/members': () => `<h1>Members</h1><p><button>Invite member</button></p><table><tr><th>Name</th><th>Role</th></tr>${state.members.map(([n, r]) => `<tr><td>${n}</td><td>${r}</td></tr>`).join('')}</table><p>Admins can change roles and billing. Members can edit articles only.</p>`,
};

const loginPage = (err) => `<!doctype html><html><head><meta charset="utf-8"><title>Sign in · Lumen Docs</title><style>body{font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0}form{width:300px}input{width:100%;padding:8px;margin:6px 0;box-sizing:border-box}button{width:100%;padding:9px;background:orange;color:#fff;border:0;border-radius:6px}</style></head>
<body><form method="post" action="/login"><h1>Lumen Docs</h1>${err ? '<p style="color:#c00">Wrong email or password</p>' : ''}<label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button>Sign in</button></form></body></html>`;

const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(new URLSearchParams(d))); });
const redirect = (res, to, cookie) => { res.writeHead(302, { location: to, ...(cookie ? { 'set-cookie': cookie } : {}) }); res.end(); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const path = url.pathname;
  const sid = (req.headers.cookie || '').match(/sid=([a-f0-9]+)/)?.[1]; const authed = sid && sessions.has(sid);
  if (path === '/login' && req.method === 'POST') { const f = await body(req); if (f.get('email') === USER && f.get('password') === PASS) { const id = crypto.randomBytes(16).toString('hex'); sessions.add(id); return redirect(res, '/dashboard', `sid=${id}; Path=/; HttpOnly`); } res.writeHead(401, { 'content-type': 'text/html' }); return res.end(loginPage(true)); }
  if (path === '/login' || path === '/') { if (authed) return redirect(res, '/dashboard'); res.writeHead(200, { 'content-type': 'text/html' }); return res.end(loginPage(false)); }
  if (path === '/logout') { sessions.delete(sid); return redirect(res, '/login', 'sid=; Path=/; Max-Age=0'); }
  if (!authed) return redirect(res, '/login');
  if (req.method === 'POST') {
    const f = await body(req);
    if (path === '/theme') state.theme = state.theme === 'light' ? 'dark' : 'light';
    else if (path === '/customize/general') state.kbName = f.get('kbName') || state.kbName;
    else if (path === '/customize/theme') { state.brand = f.get('brand'); state.theme = f.get('theme'); }
    else if (path === '/customize/domains') { const d = f.get('domain') || ''; if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d)) return redirect(res, '/customize/domains?err=1'); state.domain = d; }
    else if (path === '/articles') state.articles.push({ id: state.articles.length + 1, title: f.get('title'), status: 'draft' });
    else if (/^\/articles\/\d+\/toggle$/.test(path)) { const a = state.articles.find((x) => x.id === Number(path.split('/')[2])); if (a) a.status = a.status === 'published' ? 'draft' : 'published'; }
    return redirect(res, (req.headers.referer || '/dashboard').replace(/\?.*/, '').replace(/^https?:\/\/[^/]+/, '') || '/dashboard');
  }
  const page = pages[path]; if (!page) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(layout(path, page(url.searchParams), path));
}).listen(PORT, () => console.log('lumen docs on ' + PORT));
