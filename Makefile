.PHONY: help build db-up db-down db-reset db-migrate-local db-migrate-prod dev-scraper dev-web test gen-key install install-scraper install-web clean venv lint lint-scraper lint-web format security security-scraper security-web

# Default target
help:
	@echo "Nextdoor Podcast Discovery Platform"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Setup:"
	@echo "  venv             Create Python virtual environment"
	@echo "  install          Install all dependencies (requires venv activation)"
	@echo "  install-scraper  Install scraper dependencies only"
	@echo "  install-web      Install web dependencies only"
	@echo ""
	@echo "Database:"
	@echo "  db-up            Start local Postgres database"
	@echo "  db-down          Stop local Postgres database"
	@echo "  db-reset         Reset local database (delete all data)"
	@echo "  db-migrate-local Run migrations on local database"
	@echo "  db-migrate-prod  Show how to run migrations on Supabase"
	@echo ""
	@echo "Development:"
	@echo "  build            Build Next.js for production"
	@echo "  dev-scraper      Run scraper in dry-run mode"
	@echo "  dev-web          Start Next.js dev server"
	@echo ""
	@echo "Quality:"
	@echo "  lint             Run all linters"
	@echo "  lint-scraper     Run Python linters (ruff, mypy)"
	@echo "  lint-web         Run TypeScript linter (eslint)"
	@echo "  format           Format all code"
	@echo ""
	@echo "Security:"
	@echo "  security         Run all security scans"
	@echo "  security-scraper Run Python security scans (bandit, pip-audit)"
	@echo "  security-web     Run TypeScript security scan (npm audit)"
	@echo ""
	@echo "Testing:"
	@echo "  test             Run all tests"
	@echo "  test-scraper     Run scraper tests only"
	@echo "  test-web         Run web tests only"
	@echo ""
	@echo "Utilities:"
	@echo "  gen-key          Generate encryption key for sessions"
	@echo "  clean            Remove generated files and caches"

# Create virtual environment
venv:
	python3 -m venv .venv
	@echo ""
	@echo "Virtual environment created. Activate with:"
	@echo "  source .venv/bin/activate"

# Database
db-up:
	docker-compose up -d db
	@echo "Database running at localhost:5432"
	@echo "  User: nextdoor"
	@echo "  Password: localdev"
	@echo "  Database: nextdoor"

db-down:
	docker-compose down

db-reset:
	docker-compose down -v
	docker-compose up -d db
	@echo "Database reset complete. All data deleted."
	@echo "Migrations will run automatically on startup."

db-migrate-local:
	@echo "Running migrations on local database..."
	cat database/migrations/*.sql | docker-compose exec -T db psql -U nextdoor -d nextdoor
	@echo ""
	@echo "Running seeds..."
	cat database/seeds/*.sql | docker-compose exec -T db psql -U nextdoor -d nextdoor
	@echo ""
	@echo "Done! Tables created."

db-migrate-prod:
	@echo "=============================================="
	@echo "  SUPABASE MIGRATION INSTRUCTIONS"
	@echo "=============================================="
	@echo ""
	@echo "1. Go to: https://supabase.com/dashboard"
	@echo "2. Select your project"
	@echo "3. Go to SQL Editor"
	@echo "4. Copy and paste the contents of:"
	@echo "   - database/migrations/001_initial_schema.sql"
	@echo "5. Click 'Run'"
	@echo ""
	@echo "Optional: Run seeds/seed_neighborhoods.sql for test data"
	@echo ""
	@echo "=============================================="

# Install dependencies
install: install-scraper install-web
	@echo ""
	@echo "All dependencies installed!"

install-scraper:
	@if [ -z "$$VIRTUAL_ENV" ]; then \
		echo "Warning: No virtual environment detected."; \
		echo "Run 'make venv && source .venv/bin/activate' first."; \
		exit 1; \
	fi
	cd scraper && pip install -r requirements.txt -r requirements-dev.txt
	cd scraper && playwright install chromium

install-web:
	cd web && npm install --legacy-peer-deps

# Development
build:
	cd web && npm run build

dev-scraper:
	cd scraper && python -m src.main --dry-run

dev-web:
	cd web && npm run dev

# Linting
lint: lint-scraper lint-web

lint-scraper:
	cd scraper && ../.venv/bin/ruff format --check src/
	cd scraper && ../.venv/bin/ruff check src/
	cd scraper && ../.venv/bin/mypy src/

lint-web:
	cd web && npm run lint

format:
	cd scraper && ../.venv/bin/ruff format src/
	cd scraper && ../.venv/bin/ruff check --fix src/

# Security
security: security-scraper security-web

security-scraper:
	@echo "Running bandit (Python security linter)..."
	.venv/bin/bandit -r scraper/src/ -ll
	@echo ""
	@echo "Running pip-audit (dependency vulnerabilities)..."
	.venv/bin/pip-audit

security-web:
	@echo "Running npm audit (dependency vulnerabilities)..."
	cd web && npm audit

# Testing
test: test-scraper test-web

test-scraper:
	cd scraper && ../.venv/bin/pytest -v

test-web:
	cd web && npm test

# Utilities
gen-key:
	python scripts/generate-encryption-key.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
