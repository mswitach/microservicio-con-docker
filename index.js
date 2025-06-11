const express = require("express");
const { launchScrapingJob, jobs } = require("./gem5k-scraper");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("Microservicio activo. Usá /scrape-gem5k o /resultados-gem5k");
});

// 🚀 Iniciar scraping (asíncrono)
app.get("/scrape-gem5k", async (req, res) => {
  const jobId = randomUUID();
  jobs[jobId] = { status: "processing" };

  console.log(`🔄 Iniciando scraping con jobId: ${jobId}`);
  launchScrapingJob(jobId); // No esperamos: corre en segundo plano

  res.json({ status: "started", jobId });
});

// 📊 Consultar resultado
app.get("/resultados-gem5k", (req, res) => {
  const { jobId } = req.query;
  if (!jobId || !jobs[jobId]) {
    return res.status(404).json({ error: "jobId no encontrado o inválido" });
  }

  res.json(jobs[jobId]);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

