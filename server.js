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
    return res.status(status).json({ error: 'Error al iniciar sesión', details: err.response?.data || err.message });
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
    return res.status(status).json({ error: 'Error al crear ticket', details: err.response?.data || err.message });
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
    return res.status(status).json({ error: 'Error al consultar ticket', details: err.response?.data || err.message });
  }
});

// Health
app.get('/health', (_, res) => res.status(200).json({ ok: true }));

// Render exige escuchar en process.env.PORT en Web Services Node.js
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GLPI proxy running on :${PORT}`));
