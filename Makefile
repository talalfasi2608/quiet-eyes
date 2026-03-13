.PHONY: up down logs build db-migrate lint fmt clean ingest

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

db-migrate:
	docker compose exec api alembic upgrade head

db-downgrade:
	docker compose exec api alembic downgrade -1

# Run ingestion for a single business: make ingest BIZ=<business-uuid>
ingest:
	docker compose exec api python -m app.cli ingest $(BIZ)

# Run ingestion for all businesses
ingest-all:
	docker compose exec api python -m app.cli ingest-all

# Generate leads from mentions: make generate-leads BIZ=<business-uuid>
generate-leads:
	docker compose exec api python -m app.cli generate-leads $(BIZ)

lint:
	cd apps/api && ruff check .
	cd apps/web && npx eslint .

fmt:
	cd apps/api && ruff check --fix . && black .
	cd apps/web && npx prettier --write "src/**/*.{ts,tsx}"

clean:
	docker compose down -v --remove-orphans
