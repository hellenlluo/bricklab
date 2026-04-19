# BrickLab

A browser-based 3D brick scene editor with AI-powered generation.

---

## Architecture

| Layer | Stack | Default port |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Three.js (R3F) | 3000 |
| Backend | FastAPI + Uvicorn | 8000 |

The frontend talks to the backend over HTTP and WebSocket. Both must be running locally at the same time.

---

## Prerequisites

### System

- **Node.js** ≥ 18 and **npm**
- **Python** ≥ 3.10
- **uv** (Python package manager) — [install](https://docs.astral.sh/uv/getting-started/installation/)
- **Git**

### Gurobi license (optional but recommended)

BrickGPT uses Gurobi for physics-based stability analysis. Without it, a simpler connectivity-based method is used instead.

Academics can request a free license at [gurobi.com/academia](https://www.gurobi.com/academia/academic-program-and-licenses/).

### Hugging Face access token

BrickGPT is fine-tuned from [meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) (a gated model).

1. [Request access](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) on Hugging Face.
2. Generate a [user access token](https://huggingface.co/docs/hub/en/security-tokens).
3. Export it in your shell (or add it to `bricklab-backend/.env`):

```bash
export HF_TOKEN=hf_...
```

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd bricklab
```

The `BrickGPT` and `TripoSR` source trees under `bricklab-backend/external/` are vendored directly into this repo (no git submodules needed).

### 2. Download model weights

**SAM ViT-H** (required for image-to-3D segmentation):

```bash
curl -L https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth \
  -o bricklab-backend/external/sam_vit_h.pth
```

**BrickGPT and TripoSR** weights are downloaded automatically from Hugging Face the first time the backend starts (requires `HF_TOKEN` to be set for BrickGPT).

### 3. Install backend dependencies

```bash
cd bricklab-backend
uv sync
```

This creates a `.venv` inside `bricklab-backend` with all Python dependencies, including FastAPI, PyTorch, Transformers, and PEFT.

Additional libraries required at runtime (installed via the same `uv sync` if listed, otherwise install manually):

```bash
uv pip install segment-anything Pillow open3d trimesh
```

### 4. Configure environment variables

Create `bricklab-backend/.env`:

```bash
# Required for BrickGPT (gated Llama model)
HF_TOKEN=hf_...

# Optional: path to LDraw parts library (for brick rendering)
# LDRAW_LIBRARY_PATH=/path/to/ldraw
```

### 5. Install frontend dependencies

```bash
cd bricklab-frontend
npm install
```

---

## Running

Open two terminals.

**Backend (terminal 1):**

```bash
cd bricklab-backend
uv run serve
```

The API will be available at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

**Frontend (terminal 2):**

```bash
cd bricklab-frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Licenses & acknowledgements

BrickLab bundles or depends on the following third-party work. Their license texts must be retained when redistributing.

### Vendored source

| Project | License | Location | Source |
|---|---|---|---|
| **BrickGPT** (Pun et al., ICCV 2025) | MIT, © 2025 Ava Pun | `bricklab-backend/external/BrickGPT/LICENSE` | [github.com/AvaLovelace1/BrickGPT](https://github.com/AvaLovelace1/BrickGPT) |
| **TripoSR** (Tochilkin et al., 2024) | MIT, © 2024 Tripo AI & Stability AI | `bricklab-backend/external/TripoSR/LICENSE` | [github.com/VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR) |

### Downloaded model weights

| Model | License | Notes |
|---|---|---|
| **Llama-3.2-1B-Instruct** (used by BrickGPT) | [Llama 3.2 Community License](https://www.llama.com/llama3_2/license/) | Gated; requires accepting Meta's terms via Hugging Face. Acceptable-use policy applies. |
| **BrickGPT LoRA weights** ([AvaLovelace/BrickGPT](https://huggingface.co/AvaLovelace/BrickGPT)) | MIT | Auto-downloaded from Hugging Face. |
| **TripoSR weights** ([stabilityai/TripoSR](https://huggingface.co/stabilityai/TripoSR)) | MIT | Auto-downloaded from Hugging Face. |
| **Segment Anything (SAM ViT-H)** | Apache License 2.0 | Downloaded manually; see [facebookresearch/segment-anything](https://github.com/facebookresearch/segment-anything). |

### Dataset (training-time)

| Dataset | License |
|---|---|
| **StableText2Brick** ([AvaLovelace/StableText2Brick](https://huggingface.co/datasets/AvaLovelace/StableText2Brick)) | CC BY 4.0 — used to train BrickGPT; not bundled with BrickLab. |

### Optional tooling

- **Gurobi Optimizer** — proprietary; requires a valid license. Free academic licenses available at [gurobi.com/academia](https://www.gurobi.com/academia/).
- **LDraw parts library** — [CC BY 2.0](https://www.ldraw.org/article/340.html); only required if you enable LDraw-based brick rendering via `LDRAW_LIBRARY_PATH`.

### Attribution notice

Please cite the upstream papers if you use BrickLab in academic work:

```
@inproceedings{pun2025brickgpt,
  title={Generating Physically Stable and Buildable Brick Structures from Text},
  author={Pun, Ava and Deng, Kangle and Liu, Ruixuan and Ramanan, Deva and Liu, Changliu and Zhu, Jun-Yan},
  booktitle={ICCV},
  year={2025}
}

@article{tochilkin2024triposr,
  title={TripoSR: Fast 3D Object Reconstruction from a Single Image},
  author={Tochilkin, Dmitry and Pankratz, David and Liu, Zexiang and Huang, Zixuan and Letts, Adam and Li, Yangguang and Liang, Ding and Laforte, Christian and Jampani, Varun and Cao, Yan-Pei},
  journal={arXiv preprint arXiv:2403.02151},
  year={2024}
}

@article{kirillov2023segany,
  title={Segment Anything},
  author={Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
  journal={arXiv:2304.02643},
  year={2023}
}
```
