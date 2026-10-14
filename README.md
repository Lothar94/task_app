# Agent Fleet

Aplicación web local para gestionar una flota de agentes Claude usando tu suscripción de Claude Code.
Tú actúas como *project manager*: creas agentes (rol, instrucciones, modelo, herramientas y con quién
pueden colaborar), creas proyectos con una carpeta de trabajo y asignas tareas. Un agente puede delegar
subtareas en sus colaboradores (p. ej. CTO → Backend, Frontend, QA) y cada tarea tiene su propia
conversación, visible en tiempo real.

## Requisitos

- Node 20+ y pnpm.
- Claude Code instalado y con sesión iniciada (`claude` → `/login` con tu cuenta Pro/Max).
  El backend usa el [Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk/overview), que
  reutiliza esas credenciales. **No definas `ANTHROPIC_API_KEY`**: si existe, tiene prioridad y se
  facturaría a la API (el servidor avisa al arrancar).

## Puesta en marcha

```bash
pnpm install
pnpm seed      # opcional: crea CTO, Backend, Frontend y QA (CTO delega en el resto)
pnpm dev       # API en http://127.0.0.1:4100, web en http://localhost:5173
```

Luego: crea un proyecto con una ruta absoluta (se crea si no existe), añade agentes al equipo y
asigna una tarea al CTO.

| Variable               | Por defecto                  | Descripción                                                                   |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `PORT` / `HOST`        | `4100` / `127.0.0.1`         | Dirección de la API                                                           |
| `DATABASE_PATH`        | `data/fleet.db`              | Fichero SQLite                                                                |
| `MAX_DELEGATION_DEPTH` | `4`                          | Profundidad máxima de la cadena de delegación                                 |
| `WEB_ORIGIN`           | `http://localhost:5173`      | Origen permitido por CORS                                                     |
| `CLAUDE_EXECUTABLE`    | binario incluido en SDK      | Ruta a un `claude` concreto                                                   |
| `CLAUDE_CONFIG_DIR`    | `~/.claude`                  | Directorio de configuración de Claude Code (plugins instalados y habilitados) |
| `USER_SKILLS_DIR`      | `<CLAUDE_CONFIG_DIR>/skills` | Skills de usuario que se pueden asignar a los agentes                         |

Las skills de plugins de Claude Code se listan como `plugin:skill` (p. ej. `caveman:caveman`) y se
pueden asignar igual que las de usuario. Se leen de los plugins instalados
(`<CLAUDE_CONFIG_DIR>/plugins/installed_plugins.json`) y habilitados (`enabledPlugins` en
`<CLAUDE_CONFIG_DIR>/settings.json`); el prefijo es el `name` de su `.claude-plugin/plugin.json`.
Ojo: al cargar un plugin para usar una de sus skills también se cargan sus demás partes (hooks,
comandos y agentes). Un plugin deshabilitado o desinstalado simplemente no se carga.

## Cómo funciona la delegación

Cada ejecución de un agente recibe un servidor MCP en proceso (`fleet`) con tres herramientas:

- `list_collaborators` — compañeros en los que puede delegar (relación configurada **y** miembros del proyecto).
- `delegate_task` — crea una subtarea, la ejecuta con el colaborador y espera su resumen. Varias
  llamadas en el mismo turno se ejecutan en paralelo. Se impiden ciclos y se limita la profundidad.
- `report_result` — fija el resumen final que verá quien encargó la tarea.

Cancelar una tarea cancela también sus subtareas. Una tarea terminada puede continuarse enviando un
mensaje: se reanuda la misma sesión de Claude.

Instrucciones autogeneradas: al crear un agente, el botón **✨ Generar con Claude** redacta sus
instrucciones a partir del nombre, rol, descripción, herramientas y colaboradores, y puedes editarlas
antes de guardar. Si creas el agente con las instrucciones vacías, el servidor las genera
automáticamente (`POST /api/agents/instructions-draft` para pedir solo el borrador).

Exportar agentes: `POST /api/organizations/:id/agents/export` devuelve un JSON portable
(`{ format: "agent-fleet/agents", version: 1, exportedAt, organization, agents }`) y lo descarga con
`Content-Disposition`. El cuerpo es opcional: `agentIds` (sin él se exportan todos los agentes de la
organización) e `includeCollaborators` (añade, de forma transitiva, a quienes delegan). El fichero no
lleva ids ni fechas: cada agente trae sus campos de perfil y `collaborators` con los *nombres* de sus
colaboradores presentes en la exportación (el resto se omiten).

Intensidad por agente: `low`, `medium`, `high` (por defecto), `xhigh` o `max`. Se pasa al SDK como
`effort` y regula cuánto razona el modelo antes de actuar: más intensidad da más calidad, pero tarda
más y consume más cuota de la suscripción.

Diagrama: en **Agentes → Diagrama** se ve la flota completa (las flechas significan «delega en»). En la
página de cada proyecto se ve su equipo, con un anillo en los agentes que están trabajando en ese momento.

Máquina compartida: los agentes trabajan en tu máquina, junto a esta app. Un hook bloquea los comandos
que matan procesos por nombre o por puerto (`pkill`, `killall`, `fuser -k`, `kill $(lsof …)`…), y cada
agente sabe qué puertos usa la app (API y web) para no usarlos ni tocarlos. Si la web se cae, `make dev`
mantiene viva la API (y las tareas en curso).

Métricas: cada ejecución de un agente (la inicial y cada mensaje de seguimiento) se guarda con su
duración, turnos, resultado, error y tokens por modelo. La vista de proyecto muestra duración y tokens
de cada tarea (incluidas sus subtareas) y el **Dashboard** agrega uso por modelo, tokens por día,
resultado de las tareas, rendimiento por agente y la lista de errores. El coste es una estimación con
las tarifas de la API: con la suscripción no se cobra por token. Las tareas anteriores a esta función
cuentan en resultados y tiempos, pero no tienen tokens registrados.

Permisos por agente: `dontAsk` (solo las herramientas listadas), `acceptEdits` (además edita
ficheros) o `bypassPermissions` (sin restricciones; úsalo con cuidado, el agente trabaja en tu disco).

## Organizaciones

Una organización es el nivel superior: cada una tiene sus propios agentes, proyectos (y por tanto
tareas y métricas). Lo anterior a esta función vive en la organización «Lothar's lab» (id `default`).
Los nombres de agente son únicos **por organización**, y colaboradores, miembros de proyecto y
`delegate_task` solo ven agentes de la misma organización.

- `GET/POST /api/organizations`, `GET/PUT /api/organizations/:id` (crear y renombrar; nombre único sin
  distinguir mayúsculas).
- `GET/POST /api/organizations/:id/agents`, `GET/POST /api/organizations/:id/projects`.
- `GET /api/organizations/:id/dashboard?projectId&days` (404 si el proyecto es de otra organización).
- Siguen igual: `/api/agents/:id` (+ `/collaborators`, `/instructions-draft`), `/api/projects/:id`
  (+ `/agents`), tareas y eventos.

## Arquitectura

Monorepo pnpm con arquitectura hexagonal (Clean Architecture) en el servidor:

```
packages/shared      Contrato API: DTOs y eventos compartidos por servidor y web
apps/server/src
  domain/            Entidades y reglas (Agent, Project, Task) sin dependencias externas
  application/       Casos de uso (uno por clase) y puertos (interfaces)
  infrastructure/    Adaptadores: SQLite, Claude Agent SDK, bus de eventos, reloj, ids
  interfaces/http/   Rutas Fastify + validación Zod + SSE
  main/              Composition root (inyección de dependencias manual), arranque y seed
apps/web/src         React + TanStack Query, organizado por features (agents, projects, tasks)
```

- **SRP**: un caso de uso por clase; `TaskRecorder` persiste y notifica, `AgentBriefing` compone
  prompts, `SdkMessageMapper` traduce mensajes del SDK.
- **OCP / LSP**: `AgentRuntime` es un puerto; `ClaudeAgentRuntime` y el `FakeAgentRuntime` de los
  tests son intercambiables.
- **ISP**: repositorios por agregado y `EventPublisher`/`EventSubscriber` separados.
- **DIP**: la capa de aplicación solo depende de interfaces; el cableado vive en `main/container.ts`.

## Calidad

```bash
pnpm test        # Vitest: dominio, delegación con runtime falso, API HTTP, modelo de conversación
pnpm typecheck
pnpm lint
```
