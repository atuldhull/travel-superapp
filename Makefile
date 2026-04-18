# Makefile — DX wrapper around `docker compose -f infra/docker-compose.yml ...`
# Installed by prompt [IX.32.3]. See Playbook §32.3.
#
# Usage: `make <target>`. Run `make help` for the full list.
#
# Requires GNU Make. Linux/macOS already have it (`build-essential` / Xcode CLT).
# Windows does NOT ship `make` with Git Bash — install via one of:
#   winget install GnuWin32.Make
#   choco install make
#   scoop install make
# If you can't install make, the targets below are one-liners — copy the
# `$(COMPOSE) ...` line you want and run it directly in bash.

# ─── Variables ──────────────────────────────────────────────────────────
COMPOSE := docker compose -f infra/docker-compose.yml
PG      := $(COMPOSE) exec -T postgres
REDIS   := $(COMPOSE) exec -T redis

# Colours (best-effort; harmless on Windows where tput may be absent).
CYAN   := $(shell tput setaf 6 2>/dev/null)
YELLOW := $(shell tput setaf 3 2>/dev/null)
RESET  := $(shell tput sgr0    2>/dev/null)

.DEFAULT_GOAL := help
.PHONY: help up down logs ps reset nuke db-shell redis-shell psql-exec install dev build typecheck lint test clean-dist

# ─── Help ───────────────────────────────────────────────────────────────
help: ## List all targets with their descriptions
	@echo "$(CYAN)TravelSuperApp — developer commands$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-14s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "Run $(CYAN)make up$(RESET) first, then $(CYAN)pnpm install && pnpm --filter=api dev$(RESET)."

# ─── Docker stack ───────────────────────────────────────────────────────
up: ## Start all 8 infra services (postgres, redis, meilisearch, minio, mailpit, jaeger, prometheus, grafana)
	$(COMPOSE) up -d

down: ## Stop all services. Volumes survive.
	$(COMPOSE) down

logs: ## Tail logs from all services (Ctrl+C to stop)
	$(COMPOSE) logs -f

ps: ## Show health status of all services
	$(COMPOSE) ps

reset: ## Stop + wipe volumes + start fresh (drops all local DB data)
	$(COMPOSE) down -v
	$(COMPOSE) up -d

nuke: ## reset + also rebuild the postgres image from scratch (after Dockerfile changes)
	$(COMPOSE) down -v --rmi local
	$(COMPOSE) build --no-cache postgres
	$(COMPOSE) up -d

# ─── Shells ─────────────────────────────────────────────────────────────
db-shell: ## Open a psql shell inside the postgres container (travel_dev DB)
	$(COMPOSE) exec postgres psql -U travel -d travel_dev

redis-shell: ## Open a redis-cli shell (password: redis_dev)
	$(COMPOSE) exec redis redis-cli -a redis_dev

psql-exec: ## Run a one-off SQL statement. Usage: make psql-exec SQL="SELECT NOW();"
	@if [ -z "$$SQL" ]; then echo "Usage: make psql-exec SQL=\"<statement>\""; exit 1; fi
	$(PG) psql -U travel -d travel_dev -c "$$SQL"

# ─── Node / pnpm shortcuts ──────────────────────────────────────────────
install: ## pnpm install at workspace root
	npx pnpm@9.12.3 install

dev: ## Start apps/api in hot-reload mode (requires `make up` first)
	npx pnpm --filter=api dev

build: ## Build every workspace package + app via Turbo
	npx pnpm turbo run build

typecheck: ## tsc --noEmit across the monorepo
	npx pnpm turbo run typecheck

lint: ## ESLint across the monorepo
	npx pnpm turbo run lint

test: ## Jest across the monorepo
	npx pnpm turbo run test

clean-dist: ## Remove every dist/ and .turbo/ cache (keeps node_modules)
	rm -rf packages/*/dist packages/*/.turbo apps/*/dist apps/*/.turbo .turbo
	@echo "Cleaned package + app dist/ and .turbo/"
