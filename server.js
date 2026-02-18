import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === ENV ===
const GLPI_HOST = process.env.GLPI_HOST;            // p.ej. http://10.1.1.141:8080
const GLPI_BASE = process.env.GLPI_BASE;            // p.ej. /glpi/apirest.php
const GLPI_URL  = `${GLPI_HOST}${GLPI_BASE}`;       // entrypoint legacy: .../glpi/apirest.php
const GLPI_APP_TOKEN = process.env.GLPI_APP_TOKEN;  // App-Token del API Client (si aplica)
const DEFAULT_USER_TOKEN = process.env.GLPI_USER_TOKEN || "";

const appTokenHeader = () => (GLPI_APP_TOKEN ? { 'App-Token': GLPI_APP_TOKEN } : {});

// 1) INIT SESSION (GLPI legacy: Authorization: user_token ... en /initSession)
app.post('/api/glpi/init', async (req, res) => {
  try {
    const userToken = req.body?.user_token || DEFAULT_USER_TOKEN;
    if (!userToken) return res.status(400).json({ error: 'Falta user_token' });

    const r = await axios.get(`${GLPI_URL}/initSession`, {
      headers: { Authorization: `user_token ${userToken}`, ...appTokenHeader() }
    });
    return res.status(200).json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: 'Error al iniciar sesión',
      details: err.response?.data || err.message
    });
  }
});

// 2) CREATE TICKET
app.post('/api/glpi/tickets', async (req, res) => {
  try {
    const sessionToken = req.headers['session-token'] || req.body?.session_token;
    if (!sessionToken) return res.status(400).json({ error: 'Falta Session-Token' });

    const body = req.body?.input ? { input: req.body.input } : req.body;
    const r = await axios.post(`${GLPI_URL}/Ticket`, body, {
      headers: { 'Session-Token': sessionToken, 'Content-Type': 'application/json', ...appTokenHeader() }
    });
    return res.status(201).json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: 'Error al crear ticket',
      details: err.response?.data || err.message
    });
  }
});

// 3) GET TICKET BY ID
app.get('/api/glpi/tickets/:id', async (req, res) => {
  try {
    const sessionToken = req.headers['session-token'] || req.query.session_token;
    if (!sessionToken) return res.status(400).json({ error: 'Falta Session-Token' });

    const r = await axios.get(`${GLPI_URL}/Ticket/${req.params.id}`, {
      headers: { 'Session-Token': sessionToken, ...appTokenHeader() }
    });
    return res.status(200).json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: 'Error al consultar ticket',
      details: err.response?.data || err.message
    });
  }
});

// --------- PESTAÑAS / UI ---------

// Pestaña HTML básica (contenido embebible en Teams)
app.get('/tab', (_, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Asistente HelpMet TI</title>
        <style>
          body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#0F4C66;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}
          .card{background:#123B50;padding:24px 28px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.2);max-width:520px}
          h1{margin:0 0 8px;font-size:22px}
          p{margin:0;color:#E6F0F5}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Asistente HelpMet TI</h1>
          <p>Servicio operativo ✔️ – Render HTTPS</p>
        </div>
      </body>
    </html>
  `);
});

// Redirige la raíz a /tab (evita "Cannot GET /")
app.get('/', (req, res) => res.redirect('/tab'));

// UI mínima para crear/consultar tickets via tu proxy
app.get('/ui', (_, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Asistente HelpMet TI — UI</title>
      <style>
        :root{--bg:#0F4C66;--card:#123B50;--txt:#E6F0F5;--ok:#1ec28b;--err:#ff6b6b}
        body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:var(--bg);color:#fff}
        .wrap{max-width:980px;margin:0 auto;padding:28px;display:grid;gap:24px}
        .card{background:var(--card);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.2);padding:20px}
        h1,h2{margin:0 0 12px}
        label{display:block;margin:10px 0 4px;color:var(--txt)}
        input,textarea,select{width:100%;padding:10px;border-radius:8px;border:none;outline:none}
        textarea{min-height:90px}
        button{margin-top:12px;background:#1b88b6;border:none;color:#fff;padding:10px 16px;border-radius:8px;cursor:pointer}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .msg{margin-top:12px;padding:10px;border-radius:8px}
        .ok{background:rgba(30,194,139,.15);border:1px solid var(--ok)}
        .err{background:rgba(255,107,107,.15);border:1px solid var(--err)}
        code{color:#fff;white-space:pre-wrap}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>Asistente HelpMet TI — GLPI</h1>
          <p>Prueba funcional: crear y consultar tickets a través de tu proxy en Render (HTTPS).</p>
        </div>

        <div class="row">
          <!-- Crear ticket -->
          <div class="card">
            <h2>Crear ticket</h2>
            <label>Título</label>
            <input id="c_title" placeholder="Asunto del ticket">
            <label>Descripción</label>
            <textarea id="c_desc" placeholder="Detalle del incidente/solicitud"></textarea>
            <label>Prioridad</label>
            <select id="c_priority">
              <option value="3" selected>3 (Media)</option>
              <option value="2">2 (Baja)</option>
              <option value="4">4 (Alta)</option>
            </select>
            <label>Session-Token (GLPI)</label>
            <input id="c_token" placeholder="Pega aquí tu Session-Token (de /init)">
            <button onclick="crear()">Crear ticket</button>
            <div id="c_msg" class="msg" style="display:none"></div>
          </div>

          <!-- Consultar ticket -->
          <div class="card">
            <h2>Consultar ticket</h2>
            <label>ID de ticket</label>
            <input id="q_id" placeholder="Ej: 1234">
            <label>Session-Token (GLPI)</label>
            <input id="q_token" placeholder="Pega aquí tu Session-Token">
            <button onclick="consultar()">Consultar</button>
            <div id="q_msg" class="msg" style="display:none"></div>
          </div>
        </div>

        <!-- Obtener session_token -->
        <div class="card">
          <h2>Obtener Session-Token (Init)</h2>
          <label>User token de GLPI (Remote access key)</label>
          <input id="i_user" placeholder="TU_GLPI_USER_TOKEN (opcional si está en env)">
          <button onclick="init()">Init sesión</button>
          <div id="i_msg" class="msg" style="display:none"></div>
        </div>
      </div>

      <script>
        const base = location.origin;

        async function init(){
          const user_token = document.getElementById('i_user').value.trim();
          try{
            const r = await fetch(base + '/api/glpi/init', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify(user_token ? {user_token} : {})
            });
            const j = await r.json();
            show('i_msg', j.session_token ? 'ok' : 'err', JSON.stringify(j,null,2));
          }catch(e){ show('i_msg', 'err', e.message); }
        }

        async function crear(){
          const title = document.getElementById('c_title').value.trim();
          const desc  = document.getElementById('c_desc').value.trim();
          const prio  = document.getElementById('c_priority').value;
          const token = document.getElementById('c_token').value.trim();

          if(!title || !desc || !token){ return show('c_msg','err','Faltan campos (título, descripción o Session-Token)'); }

          const body = {
            input:{
              name: title,
              content: desc,
              priority: Number(prio),
              impact: 3, urgency: 3,
              type: 1, requesttypes_id: 2
            }
          };

          try{
            const r = await fetch(base + '/api/glpi/tickets', {
              method:'POST',
              headers:{'Content-Type':'application/json','Session-Token': token},
              body: JSON.stringify(body)
            });
            const j = await r.json();
            show('c_msg', r.ok ? 'ok' : 'err', JSON.stringify(j,null,2));
          }catch(e){ show('c_msg','err', e.message); }
        }

        async function consultar(){
          const id    = document.getElementById('q_id').value.trim();
          const token = document.getElementById('q_token').value.trim();
          if(!id || !token){ return show('q_msg','err','Faltan campos (ID o Session-Token)'); }

          try{
            const r = await fetch(base + '/api/glpi/tickets/' + encodeURIComponent(id), {
              headers:{'Session-Token': token}
            });
            const j = await r.json();
            show('q_msg', r.ok ? 'ok' : 'err', JSON.stringify(j,null,2));
          }catch(e){ show('q_msg','err', e.message); }
        }

        function show(id, kind, text){
          const el = document.getElementById(id);
          el.className = 'msg ' + (kind==='ok'?'ok':'err');
          el.style.display = 'block';
          el.innerHTML = '<code>'+escapeHtml(text)+'</code>';
        }
        function escapeHtml(s){
          return s.replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]));
        }
      </script>
    </body>
    </html>
  `);
});

// --------- HEALTH ---------

app.get('/health', (_, res) => res.status(200).json({ ok: true }));

// --------- START ---------

// Render exige escuchar en process.env.PORT en Web Services Node.js
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GLPI proxy running on :${PORT}`));
