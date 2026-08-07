FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config.py .
COPY src/ ./src/
COPY api/ ./api/
COPY artifacts/ ./artifacts/
COPY data/ ./data/
COPY logs/ ./logs/
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]