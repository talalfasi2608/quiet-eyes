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
	@echo "TODO: run migrations (alembic upgrade head)"
	@echo "Placeholder — will be wired in a future phase."

lint:
	cd apps/api && ruff check .
	cd apps/web && npx eslint .

fmt:
	cd apps/api && ruff check --fix . && black .
	cd apps/web && npx prettier --write "src/**/*.{ts,tsx}"

clean:
	docker compose down -v --remove-orphans
