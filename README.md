<!-- # React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project. -->

# IRIS Case Study: Interactive Research Ideation System

An NLP case study built on **IRIS (Interactive Research Ideation System)**, a human-in-the-loop platform that uses large language models to help researchers generate, critique, and refine novel research ideas. The project pairs the IRIS backend (Flask + Monte Carlo Tree Search + LLM agents + literature retrieval) with a modern **React + Vite** frontend.

> The backend is based on the ACL 2025 System Demonstration paper
> [IRIS: Interactive Research Ideation System for Accelerating Scientific Discovery](https://arxiv.org/abs/2504.16728)
> ([original repository](https://github.com/Anikethh/IRIS-Interactive-Research-Ideation-System)).

---

## Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [API Overview](#-api-overview)
- [Tech Stack](#-tech-stack)
- [Troubleshooting](#-troubleshooting)
- [Acknowledgements & Citation](#-acknowledgements--citation)

---

## Overview

Generating good hypotheses is the first and often hardest stage of research. Fully automated ideation pipelines are opaque and hard to steer. IRIS addresses this by keeping the researcher in control:

1. You provide a research topic or an initial idea.
2. LLM agents expand it into a **tree of candidate ideas** using Monte Carlo Tree Search (MCTS).
3. A review agent scores each idea on multiple aspects and gives **fine-grained feedback**.
4. A retrieval agent pulls in **relevant literature** (via Semantic Scholar) to ground and improve the ideas.
5. You steer the process by editing ideas, weighting review aspects, requesting improvements, or letting the system explore automatically.

## Key Features

- **MCTS-based idea exploration**: adaptive test-time compute expansion over a tree of ideas, with configurable rollouts, depth, and exploration constant.
- **Multi-aspect idea review**: structured LLM reviews with user-adjustable aspect weights.
- **Fine-grained feedback and improvement**: improve or refresh an idea based on specific review aspects.
- **Query-based literature synthesis**: generate search queries, retrieve and rerank papers, and improve ideas using retrieved knowledge (powered by `ai2-scholar-qa`).
- **Document upload**: attach `.txt`, `.pdf`, `.doc`, or `.docx` files as context (up to 16 MB).
- **Interactive tree view**: visualise the idea tree and navigate between nodes.
- **Provider-agnostic LLMs**: any provider supported by [LiteLLM](https://github.com/BerriAI/litellm) (Gemini by default).
- **Secure API key handling**: keys are set via environment variables or the app's key manager, never hardcoded.
- **Math-friendly rendering**: Markdown, GFM, and LaTeX (KaTeX) rendering in the React UI.

## Architecture

```
┌──────────────────────┐     REST / Socket.IO     ┌──────────────────────────────┐
│  React + Vite UI     │ ───────────────────────► │  Flask backend (app.py)      │
│  (IRIS-frontend)     │ ◄─────────────────────── │                              │
└──────────────────────┘                          │  ┌────────────────────────┐  │
                                                  │  │ MCTS (tree / node)     │  │
                                                  │  └──────────┬─────────────┘  │
                                                  │      ┌──────┴───────┐        │
                                                  │  Ideation      Review        │
                                                  │   Agent         Agent        │
                                                  │      └──────┬───────┘        │
                                                  │      Retrieval Agent         │
                                                  │   (ScholarQA + reranker)     │
                                                  └──────────────┬───────────────┘
                                                                 │
                                          ┌──────────────────────┴───────────────┐
                                          │ LLM provider (via LiteLLM) and       │
                                          │ Semantic Scholar API                 │
                                          └──────────────────────────────────────┘
```

## Project Structure

```
.
├── IRIS-backend/
│   ├── app.py                  # Flask + Socket.IO application entry point
│   ├── patch.py                # Utility script to patch retrieval with a mock fallback
│   ├── pyproject.toml          # Python dependencies (managed with uv)
│   ├── .env.example            # Template for required environment variables
│   ├── config/
│   │   ├── config.yaml         # App, MCTS, LLM, retrieval, and security settings
│   │   ├── prompts.yaml        # Agent prompts
│   │   └── ideas.yaml          # Seed ideas
│   ├── src/
│   │   ├── agents/             # Ideation, review, structured review, retrieval agents
│   │   ├── mcts/               # MCTS tree and node implementation
│   │   ├── models/             # LLM wrapper
│   │   ├── utils/              # Paper processing, key manager
│   │   └── retrieval_api/      # ScholarQA-based retrieval service (Docker-ready)
│   ├── templates/              # Legacy Flask HTML templates
│   ├── static/                 # Legacy Flask static assets (JS/CSS/icons)
│   └── assets/                 # Diagrams and screenshots
├── IRIS-frontend/
│   ├── src/                    # React application (App.jsx, main.jsx, styles)
│   ├── public/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites

- **Python** ≥ 3.10
- **Node.js** ≥ 18 and **npm**
- [`uv`](https://docs.astral.sh/uv/) (recommended) or any Python virtual environment tool
- API keys:
  - [Semantic Scholar API key](https://www.semanticscholar.org/product/api#api-key-form)
  - An LLM API key (e.g. [Google Gemini](https://aistudio.google.com/app/apikey)), or any provider supported by LiteLLM

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/NLP-casestudy.git
cd NLP-casestudy
```

### 2. Set up the backend

```bash
cd IRIS-backend

# Create the environment and install dependencies
uv sync
source .venv/bin/activate        # Windows: .venv\Scripts\activate
```

Not using `uv`? A plain virtual environment works too:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 3. Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

```env
SEMANTIC_SCHOLAR_API_KEY=your_semantic_scholar_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
FLASK_SECRET_KEY=your_flask_secret_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

> Never commit your `.env` file. It is already listed in `.gitignore`.

### 4. Run the backend

```bash
python app.py
```

The API starts on **http://127.0.0.1:5000**.

### 5. Run the frontend

In a new terminal:

```bash
cd IRIS-frontend
npm install
npm run dev
```

Open the URL printed by Vite (usually **http://localhost:5173**).

> The frontend expects the backend at `http://127.0.0.1:5000/api`. If you change the backend host or port, update `API_BASE_URL` in `IRIS-frontend/src/App.jsx`.

### Optional: build the frontend for production

```bash
npm run build      # outputs to IRIS-frontend/dist
npm run preview    # preview the production build locally
```

### Optional: standalone retrieval API (Docker)

The `IRIS-backend/src/retrieval_api` directory contains a standalone ScholarQA service:

```bash
cd IRIS-backend/src/retrieval_api
docker build -t iris-retrieval-api .
docker run -p 8000:8000 --env-file ../../.env iris-retrieval-api
```

## Configuration

Most behaviour is controlled in [`IRIS-backend/config/config.yaml`](IRIS-backend/config/config.yaml):

| Section | Key settings |
|---|---|
| `experiment` | `n_rollouts`, `max_depth`, `seed`, results/log directories |
| `mcts` | `exploration_constant`, `max_iterations`, `max_depth`, `discount_factor` |
| `ideation_agent` / `review_agent` | LLM `model`, `temperature`, `max_tokens`, `top_p` |
| `retrieval_agent` | `max_papers`, `chunk_size`, `rerank_top_k` |
| `default_models` | Default LLM and reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`) |
| `storage` | Upload folder, allowed file types, max file size (16 MB) |
| `app` | Host, port, debug mode |

**Switching LLM provider:** change the `model` field under `ideation_agent` and `review_agent` to any LiteLLM model string (e.g. `gemini/gemini-2.0-flash`) and set the matching API key in `.env`.

Agent prompts can be tuned in [`config/prompts.yaml`](IRIS-backend/config/prompts.yaml).

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/idea` | Get the current idea |
| `POST` | `/api/chat` | Chat with the ideation agent |
| `POST` | `/api/step` | Run an MCTS step (expand / evaluate) |
| `GET` | `/api/tree` | Retrieve the idea tree |
| `POST` | `/api/node` | Select or inspect a tree node |
| `POST` | `/api/review_aspect` | Review an idea on a specific aspect |
| `POST` | `/api/improve_idea` | Improve an idea from review feedback |
| `POST` | `/api/set_aspect_weights` | Adjust review aspect weights |
| `POST` | `/api/generate_query` | Generate a literature search query |
| `POST` | `/api/retrieve_knowledge` | Retrieve and synthesise literature |
| `POST` | `/api/improve_idea_with_knowledge` | Improve an idea using retrieved papers |
| `POST` | `/api/refresh_idea` | Regenerate an idea |
| `POST` | `/api/upload` | Upload a context document |
| `POST` | `/api/set_api_key` | Set an API key at runtime |
| `GET` | `/api/get_api_keys` | List configured API keys |
| `POST` | `/api/delete_api_key` | Remove a stored API key |

Socket.IO events `start_exploration` and `stop_exploration` drive automatic MCTS exploration.

## Tech Stack

**Backend:** Python, Flask, Flask-SocketIO, Flask-CORS, LiteLLM, `ai2-scholar-qa`, PyMuPDF, Loguru, LangSmith

**Frontend:** React 19, Vite, Axios, Framer Motion, Lucide React, React Markdown, KaTeX

**NLP / ML:** Monte Carlo Tree Search, LLM agents, retrieval-augmented generation, cross-encoder reranking

## Troubleshooting

- **Semantic Scholar rate limits / 429 errors**: make sure `SEMANTIC_SCHOLAR_API_KEY` is set. `patch.py` can add a mock-data fallback so the app keeps working for demos when the API is rate limited.
- **Frontend can't reach the backend**: confirm the backend is running on port 5000 and that `API_BASE_URL` in `App.jsx` matches.
- **LLM errors**: check that the API key matches the provider in the configured `model` string.
- **Port already in use**: change `app.port` in `config.yaml` or stop the conflicting process.

## Acknowledgements & Citation

This project builds on the work of the IRIS authors. If you use it, please cite the original paper:

```bibtex
@inproceedings{garikaparthi-etal-2025-iris,
    title = "{IRIS}: Interactive Research Ideation System for Accelerating Scientific Discovery",
    author = "Garikaparthi, Aniketh  and
      Patwardhan, Manasi  and
      Vig, Lovekesh  and
      Cohan, Arman",
    booktitle = "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 3: System Demonstrations)",
    month = jul,
    year = "2025",
    address = "Vienna, Austria",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2025.acl-demo.57/",
    doi = "10.18653/v1/2025.acl-demo.57",
    pages = "592--603"
}
```

