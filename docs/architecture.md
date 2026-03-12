# QuietEyes — Architecture Notes

## Phase 0: Scaffold

### Services (Docker Compose)
| Service  | Image / Build        | Port(s)       |
|----------|----------------------|---------------|
| postgres | pgvector/pgvector:pg16 | 5432        |
| redis    | redis:7-alpine       | 6379          |
| minio    | minio/minio:latest   | 9000, 9001    |
| api      | ./apps/api           | 8000          |
| web      | ./apps/web           | 3000          |

### Directory Layout
```
QuietEyes/
├── apps/
│   ├── api/          # FastAPI + Python 3.12
│   └── web/          # Next.js 15 + React 19 + Tailwind v4
├── infra/            # Future: Terraform, k8s manifests
├── docs/             # This file and future ADRs
├── docker-compose.yml
├── Makefile
└── .env.example
```

### Key Decisions
- **pgvector** enabled from day one for future embedding/search features.
- **Minio** present but unused until file-upload phase.
- Hot-reload for both api (uvicorn --reload) and web (next dev --turbopack).
