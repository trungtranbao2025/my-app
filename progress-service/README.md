# Progress Service (FastAPI)

API tính toán chỉ số tiến độ cho từng dự án và tích hợp Todoist/Slack.

- REST: `POST /progress/compute`
- Integrations: `POST /integrations/todoist`, `POST /integrations/slack`
- Observability: `/metrics` (Prometheus), OpenTelemetry (OTLP env)
- i18n: vi-VN thông điệp email
- 12-factor: cấu hình qua biến môi trường (.env chỉ ví dụ)

## Chạy nhanh (local)

```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Docker

```bash
docker build -t progress-service .
docker run -p 8000:8000 --env-file .env.example progress-service
```

## docker-compose

```bash
docker compose up --build
```

## Test

```bash
pytest
```

## Biến môi trường

Xem `.env.example`.

## OpenAPI

Sau khi chạy: http://localhost:8000/docs và `/openapi.json`. File `openapi.yaml` được cung cấp sẵn.
