.PHONY: up down logs build db-migrate lint fmt clean

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

lint:
	cd apps/api && ruff check .
	cd apps/web && npx eslint .

fmt:
	cd apps/api && ruff check --fix . && black .
	cd apps/web && npx prettier --write "src/**/*.{ts,tsx}"

clean:
	docker compose down -v --remove-orphans
