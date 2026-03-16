# QuietEyes — Deployment Guide

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ (with pgvector extension)
- Redis 7+

### API Setup
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env with your local values

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### Web Setup
```bash
cd apps/web
npm install
npm run dev   # starts on http://localhost:3000
```

### Background Workers (optional)
```bash
cd apps/api
celery -A app.celery_app worker --loglevel=info
celery -A app.celery_app beat --loglevel=info
```

## Production Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/quieteyes` |
| `JWT_SECRET` | Strong random secret (min 32 chars) | `openssl rand -hex 32` |

### Recommended
| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `STRIPE_SECRET_KEY` | Stripe API key | (stub mode if empty) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | |
| `TAVILY_API_KEY` | Tavily search API key | (search disabled if empty) |
| `ADMIN_EMAILS` | Comma-separated admin emails | |

### Optional Tuning
| Variable | Description | Default |
|----------|-------------|---------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | JWT refresh token TTL | `7` |
| `MIN_PASSWORD_LENGTH` | Password minimum length | `8` |
| `RATE_LIMIT_AUTH` | Auth endpoint rate limit | `10/minute` |
| `RATE_LIMIT_DEFAULT` | Default API rate limit | `60/minute` |

## Deployment Sequence

1. **Database migrations**: Run `alembic upgrade head` before deploying new code.
2. **Deploy API**: Start uvicorn workers (recommend gunicorn with uvicorn workers in production).
3. **Deploy Web**: Build with `npm run build`, serve with `npm start`.
4. **Start workers**: Launch Celery worker and beat processes.
5. **Verify health**: Hit `GET /health` and `GET /health/deep` to confirm connectivity.

### Production Command Examples
```bash
# API (with gunicorn)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Web
cd apps/web && npm run build && npm start

# Workers
celery -A app.celery_app worker -c 4 --loglevel=warning
celery -A app.celery_app beat --loglevel=warning
```

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic liveness check |
| `GET /health/deep` | DB + Redis connectivity, API latency stats |

## Backup Considerations

- **PostgreSQL**: Use `pg_dump` for full backups. Schedule daily via cron or managed DB snapshots.
- **Redis**: Enable AOF persistence or RDB snapshots. Redis data is ephemeral (rate limits, cache) — loss is non-critical.
- **File exports**: If using local storage for CSV exports, back up the export directory. Consider migrating to S3/MinIO for production.

## Rollback Considerations

- **Database**: Alembic supports `alembic downgrade -1` for single-step rollback. Test downgrades in staging before production.
- **API**: Deploy behind a load balancer with blue-green or rolling deployments. Keep previous container/version available for quick rollback.
- **Web**: Static builds can be reverted by redeploying previous build artifact.
- **Breaking migrations**: If a migration adds columns, the old code can still run (additive migrations are safe). If a migration removes columns, deploy new code first, then migrate.

## Monitoring

- `GET /ops/system/health` — API latency, job queue, integration failures, source health
- `GET /ops/costs/summary` — Cost tracking and AI usage
- `GET /ops/usage/trends` — Daily usage trends
- `GET /ops/quota/status` — Per-resource quota status with warnings
