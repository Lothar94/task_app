.DEFAULT_GOAL := help
.PHONY: help install seed dev server web build start test typecheck lint check clean reset-db

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Instala las dependencias
	pnpm install

seed: ## Crea el equipo de ejemplo (CTO, Backend, Frontend, QA)
	pnpm seed

dev: ## Arranca API y web en modo desarrollo
	pnpm dev

server: ## Arranca solo la API (http://127.0.0.1:4100)
	pnpm --filter @fleet/server dev

web: ## Arranca solo la web (http://localhost:5173)
	pnpm --filter @fleet/web dev

build: ## Compila la web
	pnpm --filter @fleet/web build

start: build ## Arranca la API y sirve la web compilada (http://localhost:5173)
	trap 'kill 0' INT TERM EXIT; \
	pnpm --filter @fleet/server start & \
	pnpm --filter @fleet/web preview --port 5173 & \
	wait

test: ## Ejecuta los tests
	pnpm test

typecheck: ## Comprueba los tipos
	pnpm typecheck

lint: ## Pasa ESLint
	pnpm lint

check: lint typecheck test ## Lint, tipos y tests

clean: ## Borra dependencias y artefactos de compilación
	rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/dist

reset-db: ## Borra la base de datos local (agentes, proyectos y tareas)
	rm -rf data
