# Image de déploiement de l'API de scoring crédit
FROM python:3.11-slim

WORKDIR /app

# Dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code + artefacts du modèle
COPY config.py .
COPY src/ ./src/
COPY api/ ./api/
COPY artifacts/ ./artifacts/

# Port exposé (les plateformes cloud injectent souvent $PORT)
ENV PORT=8000
EXPOSE 8000

# Lancement du serveur
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]