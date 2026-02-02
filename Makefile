.PHONY: help db-up db-down dev-scraper dev-web test gen-key install install-scraper install-web clean venv

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
	@echo ""
	@echo "Development:"
	@echo "  dev-scraper      Run scraper in dry-run mode"
	@echo "  dev-web          Start Next.js dev server"
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
dev-scraper:
	cd scraper && python -m src.main --dry-run

dev-web:
	cd web && npm run dev

# Testing
test: test-scraper test-web

test-scraper:
	cd scraper && pytest

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
