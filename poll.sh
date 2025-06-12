#!/usr/bin/env bash
set -e

# 1) Solicita el inicio del scraping y captura el jobId
echo "🌐 Iniciando scraping..."
JOB=$(curl -s -X POST https://microservicio-con-docker.onrender.com/start-scrape \
      | jq -r '.jobId')
echo "✉️  Job iniciado: $JOB"

# 2) Pequeña espera antes de empezar a chequear (opcional)
sleep 5

# 3) Polling hasta que el job termine o falle
while true; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    https://microservicio-con-docker.onrender.com/scrape-result/$JOB)

  if [ "$HTTP" = "202" ]; then
    echo "⌛ Job pendiente (HTTP 202). Reintentando en 5s..."
    sleep 5
    continue

  elif [ "$HTTP" = "200" ]; then
    echo "✅ Job completado. Obteniendo datos:"
    curl -s https://microservicio-con-docker.onrender.com/scrape-result/$JOB | jq
    break

  else
    echo "❌ Error inesperado (HTTP $HTTP). Mostrando respuesta completa:"
    curl -i https://microservicio-con-docker.onrender.com/scrape-result/$JOB
    exit 1
  fi
done

