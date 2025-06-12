// index.js  (Render microservice)
// Servidor Express que maneja scraping asíncrono y resultados almacenados por jobId

/**
 * Instrucciones:
 * 1. npm init -y
 * 2. npm install express cors uuid fs-extra playwright
 * 3. Ejecutar: node index.js
 * 4. ENDPOINTS:
 *    POST /start-scrape         → inicia nuevo job, devuelve { jobId }
 *    GET  /scrape-result/:jobId → 202 si pending, 200 y stream JSON si done, 404 si jobId desconocido
 *
 * DEBUG:
 * - Logs de creación y estado de jobs
 * - Archivo de resultados en ./jobs/<jobId>.json
 */
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
// Importa tu motor de scraping (Playwright u otro)
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 4000;
const JOBS_DIR = path.join(__dirname, 'jobs');

app.use(cors());
app.use(express.json());

// Asegura carpeta de jobs
fs.ensureDirSync(JOBS_DIR);

// Estructura de estado en memoria
const jobs = {}; // { jobId: { status: 'pending'|'done'|'error', file: <path> } }

// Función principal de scraping
async function scrapeNuBlog() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://microservicio-con-docker.onrender.com/scrape-nublog');
  const text = await page.evaluate(() => document.body.innerText);
  const posts = JSON.parse(text);
  await browser.close();
  return posts;
}

// POST /start-scrape
app.post('/start-scrape', (req, res) => {
  const jobId = uuidv4();
  const outPath = path.join(JOBS_DIR, `${jobId}.json`);
  jobs[jobId] = { status: 'pending', file: outPath };
  console.log(`Job creado: ${jobId}`);

  // Arranca scraping en background
  (async () => {
    try {
      const data = await scrapeNuBlog();
      await fs.writeJson(outPath, data, { spaces: 2 });
      jobs[jobId].status = 'done';
      console.log(`Job completado: ${jobId}`);
    } catch (err) {
      jobs[jobId].status = 'error';
      console.error(`Error en job ${jobId}:`, err);
    }
  })();

  res.json({ jobId });
});

// GET /scrape-result/:jobId
app.get('/scrape-result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  if (!job) {
    return res.status(404).json({ error: 'jobId desconocido' });
  }
  if (job.status === 'pending') {
    console.log(`Job pendiente: ${jobId}`);
    return res.status(202).json({ status: 'pending' });
  }
  if (job.status === 'error') {
    return res.status(500).json({ status: 'error' });
  }
  // done
  console.log(`Enviando resultados de job ${jobId}`);
  res.setHeader('Content-Type', 'application/json');
  fs.createReadStream(job.file).pipe(res);
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Microservicio de scraping corriendo. Usa /start-scrape y /scrape-result/:jobId');
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => console.log(`Microservicio escuchando en http://localhost:${PORT}`));
