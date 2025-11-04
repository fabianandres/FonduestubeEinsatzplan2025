const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// sessions for admin
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// serve static public folder
app.use('/', express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'events.json');

function readEvents(){
  try{
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  }catch(e){
    console.error('Failed to read events:', e.message);
    return [];
  }
}

function writeEvents(events){
  try{
    fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), 'utf8');
    return true;
  }catch(e){
    console.error('Failed to write events:', e.message);
    return false;
  }
}

app.get('/api/events', (req, res) => {
  const events = readEvents();
  res.json(events);
});

const csurf = require('csurf');

// optional OpenID Connect (Microsoft) setup using openid-client
let useOIDC = false;
try{
  const { Issuer, generators } = require('openid-client');
  const OIDC_ISSUER = process.env.OIDC_ISSUER; // e.g. https://login.microsoftonline.com/{tenant}/v2.0
  const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
  const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
  const OIDC_REDIRECT = process.env.OIDC_REDIRECT || `http://localhost:${PORT}/auth/callback`;
  if(OIDC_ISSUER && OIDC_CLIENT_ID && OIDC_CLIENT_SECRET){
    useOIDC = true;
    (async ()=>{
      try{
        const issuer = await Issuer.discover(OIDC_ISSUER);
        const client = new issuer.Client({ client_id: OIDC_CLIENT_ID, client_secret: OIDC_CLIENT_SECRET, redirect_uris: [OIDC_REDIRECT], response_types: ['code'] });
        app.get('/auth/login', (req, res)=>{
          const code_verifier = generators.codeVerifier();
          const code_challenge = generators.codeChallenge(code_verifier);
          req.session.code_verifier = code_verifier;
          const url = client.authorizationUrl({ scope: 'openid profile email', code_challenge, code_challenge_method: 'S256' });
          res.redirect(url);
        });
        app.get('/auth/callback', async (req, res)=>{
          try{
            const params = client.callbackParams(req);
            const tokenSet = await client.callback(OIDC_REDIRECT, params, { code_verifier: req.session.code_verifier });
            const userinfo = await client.userinfo(tokenSet.access_token);
            // mark admin session
            req.session.admin = true;
            req.session.user = userinfo;
            res.redirect('/admin.html');
          }catch(err){
            console.error('OIDC callback error', err && err.stack || err);
            res.status(500).send('OIDC error');
          }
        });
        app.post('/auth/logout', (req,res)=>{ req.session.destroy(()=>res.json({ok:true})); });
      }catch(e){ console.error('OIDC setup failed', e && e.stack || e); }
    })();
  }
}catch(e){ /* openid-client not installed or failed */ }

// CSRF protection (uses session)
const csrfProtection = csurf({ cookie: false });

// admin auth
function requireAdmin(req, res, next){
  if(req.session && req.session.admin) return next();
  res.status(401).json({error:'unauthorized'});
}

app.post('/admin/login', (req, res) => {
  const pass = req.body.password;
  const expected = process.env.ADMIN_PASS || 'adminpass';
  if(pass === expected){ req.session.admin = true; return res.json({ok:true}); }
  res.status(403).json({error:'invalid'});
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(()=> res.json({ok:true}));
});

// admin endpoints
// return events and CSRF token for admin UI
app.get('/admin/events', requireAdmin, csrfProtection, (req, res) => {
  res.json({ events: readEvents(), csrfToken: req.csrfToken() });
});

app.put('/admin/events/:id', requireAdmin, csrfProtection, (req, res) => {
  const id = req.params.id;
  const events = readEvents();
  const idx = events.findIndex(e=>e.id===id);
  if(idx===-1) return res.status(404).json({error:'not found'});
  // replace fields allowed: leader, title, time, tasks
  const allowed = ['leader','title','time','tasks','date'];
  allowed.forEach(k=>{ if(req.body[k] !== undefined) events[idx][k]=req.body[k]; });
  if(!writeEvents(events)) return res.status(500).json({error:'failed to save'});
  res.json({ok:true, event:events[idx]});
});

// simple endpoint to claim a helper for a specific shift/task (non-authenticated)
app.post('/api/events/:id/tasks/:taskIdx/claim', (req, res) => {
  const id = req.params.id;
  const taskIdx = Number(req.params.taskIdx);
  const name = req.body.name;
  if(!name) return res.status(400).json({error:'name required'});
  const events = readEvents();
  const ev = events.find(e => e.id === id);
  if(!ev) return res.status(404).json({error:'event not found'});
  const task = ev.tasks[taskIdx];
  if(!task) return res.status(404).json({error:'task not found'});
  task.helpers = task.helpers || [];
  if(task.helpers.length >= task.required) return res.status(409).json({error:'task full'});
  task.helpers.push(name);
  if(!writeEvents(events)) return res.status(500).json({error:'failed to save'});
  res.json({ok:true, event:ev});
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

