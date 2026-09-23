# DataFlow — Data Engineering Workflow Builder

Plataforma visual de workflows para Engenharia de Dados. Monte pipelines
conectando nodes no canvas:

**Sources → Ingestion → Processing → Data Quality → Storage → Consumption**

Exemplo: `API → Bronze → Transform → Data Quality → Silver → Gold → PostgreSQL`

Inspirada no conceito visual de ferramentas como o n8n, com identidade própria
voltada a Data Engineers. A execução de workflows ainda não existe — o foco
atual é o editor visual + persistência.

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
npm run lint     # oxlint
npm run preview  # serve o build de produção
```

## Estrutura do projeto

```
data-flow/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI + CORS + lifespan
│   │   ├── database.py        # conexão e schema SQLite
│   │   ├── models.py          # schemas Pydantic
│   │   ├── repository.py      # acesso a dados
│   │   └── routers/
│   │       ├── health.py      # GET /api/health
│   │       └── workflows.py   # CRUD /api/workflows
│   ├── data/                  # dataflow.db (gerado)
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
        │   └── icons/         # conjunto de ícones SVG inline
        ├── nodes/             # definições + registry (um arquivo por categoria)
        ├── types/             # tipos compartilhados (WorkflowNode, NodeDefinition…)
        ├── data/              # workflow demo (REST API → Bronze → Silver → Gold)
        ├── hooks/             # useWorkflow (estado + persistência)
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
| DELETE | `/api/workflows/{id}` | exclui workflow |

Persistência em SQLite (`backend/data/dataflow.db`).

## Funcionalidades atuais

- Canvas com pan, zoom, minimap, controles, grid
- Node Library com 5 categorias (Sources, Processing, Data Quality, Storage,
  Orchestration) — 22 node types, arrastáveis para o canvas
- Conexões entre nodes (criar, selecionar, apagar)
- Editar node: rename inline no card, name/description/status no painel
- Excluir node: botão no card, botão no painel ou Backspace/Delete
- CRUD de workflows na interface (dropdown no header): criar, abrir,
  renomear, excluir; Save grava via API; load automático ao abrir
- Indicadores na status bar: API online/offline, nodes, conexões,
  mudanças não salvas

## O que ainda NÃO existe (próximas etapas)

Execução de workflow, backend de orquestração (Airflow/Spark/dbt/Kafka),
autenticação, data quality real, data lineage, monitoramento, logs,
geração de código, integração com cloud.

## Node registry

Adicionar um node type = criar uma definição em `frontend/src/nodes/`
(arquivo da categoria) com `type`, `label`, `category`, `description` e
`icon`. Sidebar, canvas, minimap e painel passam a mostrá-lo automaticamente
via `frontend/src/nodes/registry.ts`.

## Licença

MIT — veja [LICENSE](LICENSE).
