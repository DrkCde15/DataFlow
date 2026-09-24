# DataFlow — Data Engineering Workflow Builder

Plataforma visual de workflows para Engenharia de Dados. Monte pipelines
conectando nodes no canvas:

**Sources → Ingestion → Processing → Data Quality → Storage → Consumption**

Exemplo: `API → Bronze → Transform → Data Quality → Silver → Gold → PostgreSQL`

Inspirada no conceito visual de ferramentas como o n8n, com identidade própria
voltada a Data Engineers. O foco atual é o editor visual + persistência +
execução local de workflows.

## Stack

| Parte | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite + React Flow (`@xyflow/react`) + CSS moderno (dark mode) |
| Backend | Python + FastAPI + SQLite |

## Como rodar

### 1. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

API em `http://localhost:8000` (docs em `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`.

> A URL da API pode ser alterada com a variável `VITE_API_URL`
> (padrão: `http://localhost:8000`).

### Scripts do frontend

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # typecheck (tsc) + build de produção
npm run test     # vitest (registry, utils, api client)
npm run lint     # oxlint
npm run preview  # serve o build de produção
```

Testes do backend:

```bash
cd backend
.venv/bin/python -m pytest -q
```

## Estrutura do projeto

```
data-flow/
├── .github/workflows/       # CI (lint, testes, build, smoke da API)
├── docs/                    # revisão de engenharia de dados
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI + CORS + lifespan
│   │   ├── database.py        # conexão e schema SQLite
│   │   ├── models.py          # schemas Pydantic
│   │   ├── repository.py      # acesso a dados
│   │   ├── executor/          # engine (topo sort, handlers, runs)
│   │   └── routers/
│   │       ├── health.py      # GET /api/health
│   │       ├── workflows.py   # CRUD /api/workflows
│   │       ├── files.py       # upload /api/files
│   │       ├── connections.py # CRUD /api/connections
│   │       ├── migrations.py  # POST /api/migrations/*
│   │       └── runs.py        # execução e histórico
│   ├── tests/                 # pytest (DB isolado por teste)
│   ├── data/                  # dataflow.db + uploads (gerado)
│   ├── requirements.txt
│   └── .venv/
│
└── frontend/
    └── src/
        ├── components/
        │   ├── canvas/        # wrapper do React Flow
        │   ├── nodes/         # node customizado + context de ações
        │   ├── sidebar/       # node library (drag & drop)
        │   ├── panels/        # painel de propriedades
        │   ├── layout/        # header, menu de workflows, status bar
        │   ├── connections/   # modal de gerenciamento de connections
        │   └── icons/         # conjunto de ícones SVG inline
        ├── nodes/             # definições + registry (um arquivo por categoria)
        ├── types/             # tipos compartilhados (WorkflowNode, NodeDefinition…)
        ├── data/              # workflow demo (REST API → Bronze → Silver → Gold)
        ├── hooks/             # useWorkflow (estado + persistência + execução)
        ├── api/               # client HTTP tipado
        ├── utils/             # cores do tema, formatação, dnd
        ├── pages/             # composição da página do editor
        └── styles/            # tokens e estilos globais
```

## API

| Método | Rota | Função |
|---|---|---|
| GET | `/api/health` | teste de vida da API |
| GET | `/api/workflows` | lista (resumo: nome, nodes, edges, datas) |
| POST | `/api/workflows` | cria workflow `{name, nodes, edges}` |
| GET | `/api/workflows/{id}` | carrega workflow completo |
| PUT | `/api/workflows/{id}` | atualiza (parcial: aceita só `name`, ou `nodes`/`edges`) |
| DELETE | `/api/workflows/{id}` | exclui workflow (remove também arquivos não referenciados por outros) |
| POST | `/api/files` | upload de arquivo (máx. 50MB, retorna `{id, filename, size}`) |
| GET | `/api/connections` | lista connections (sem o segredo) |
| POST | `/api/connections` | cria connection `{name, type, connection_string}` |
| GET | `/api/connections/{id}` | detalhe da connection (sem o segredo) |
| PUT | `/api/connections/{id}` | atualiza (parcial; segredo em branco mantém o atual) |
| DELETE | `/api/connections/{id}` | exclui (409 se estiver em uso por workflows) |
| POST | `/api/migrations/connection-strings` | migra `connection_string` em texto para Connections (`?dry_run=true` só simula) |
| POST | `/api/workflows/{id}/run` | executa o workflow (salva o resultado como run) |
| GET | `/api/workflows/{id}/runs` | histórico de runs do workflow |
| GET | `/api/runs/{run_id}` | detalhe de um run |

Persistência em SQLite (`backend/data/dataflow.db`).

## Funcionalidades atuais

- **Home**: tela inicial com cards dos workflows (abrir, criar, renomear,
  excluir, busca) + botão de demo
- Canvas com pan, zoom, minimap, controles, grid
- Node Library com 5 categorias (Sources, Processing, Data Quality, Storage,
  Orchestration) — 24 node types, arrastáveis para o canvas
- Configuração por node type: cada node define um `configSchema` e o painel
  de propriedades renderiza o formulário dinamicamente (texto, select,
  número, textarea, arquivo)
- Node **File** (Sources): importe um arquivo local — o upload vai para o
  backend (`POST /api/files`, máx. 50MB) e a referência fica na config do node
- **Connections**: credenciais (PostgreSQL, MySQL, Warehouse) gerenciadas em
  entidade separada (`/api/connections`) — o segredo nunca volta na API e os
  nodes guardam só o `connection_id`; exclusão bloqueada (409) se estiver em uso
- Conexões entre nodes (criar, selecionar, apagar)
- Editar node: rename inline no card, name/description/status no painel
- Excluir node: botão no card, botão no painel ou Backspace/Delete
- CRUD de workflows na interface (dropdown no header): criar, abrir,
  renomear, excluir; Save grava via API; load automático ao abrir
- **Execute**: roda o workflow no backend, com status por node no canvas,
  seção Last run no painel e estado na status bar
- Indicadores na status bar: API online/offline, nodes, conexões,
  mudanças não salvas, estado do run

## Execução de workflows

O botão **Execute** roda o workflow salvo no backend: os nodes são ordenados
topologicamente e executados em sequência, com **fail-fast** no primeiro node
que falhar. Cada node mostra o status no canvas (amarelo/verde/vermelho) e o
detalhe no painel (linhas, colunas, logs, erro). Runs ficam persistidos
(`GET /api/workflows/{id}/runs`).

Nodes executáveis hoje: `file` (csv/json), `filter`, `join` (inner/left/right),
`aggregate`, `null-check`, `duplicate-check`, `schema-validation`,
`data-freshness`, `rest-api`, `python`, `sql` (SQLite em memória),
`workflow-call` (executa outro workflow; saída = linhas dos sinks),
`schedule`/`trigger` (no-op de entrada). Os demais retornam erro claro
(`"<type>" is not executable yet`).

> O node `python` executa código arbitrário com `exec` — aceitável para uso
> local single-user, mas nunca exponha a API sem autenticação.

## O que ainda NÃO existe (próximas etapas)

Orquestração real (agendamento/condicionais executando de verdade),
conectores de escrita (PostgreSQL, Parquet, Delta), autenticação, data
lineage, monitoramento com alertas, geração de código, integração com cloud,
execução assíncrona/background workers.

## Node registry

Adicionar um node type = criar uma definição em `frontend/src/nodes/`
(arquivo da categoria) com `type`, `label`, `category`, `description` e
`icon`. Sidebar, canvas, minimap e painel passam a mostrá-lo automaticamente
via `frontend/src/nodes/registry.ts`.

## Licença

MIT — veja [LICENSE](LICENSE).
