# BrickLab

A browser-based 3D brick scene editor with AI-powered generation.

| Layer | Stack | Default port |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Three.js (R3F) | 3000 |
| Backend | FastAPI + Uvicorn (Python ≥ 3.10) | 8000 |

The frontend talks to the backend over HTTP and WebSocket. Both must be running locally.

---

## Prerequisites

### System

- **Node.js** ≥ 18 with **npm**
- **Python** ≥ 3.10
- **uv** — [install instructions](https://docs.astral.sh/uv/getting-started/installation/)
- **Git**

### Hugging Face access token (required)

BrickGPT is fine-tuned from [meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct), a gated model.

1. Request access on the model page.
2. Generate a [user access token](https://huggingface.co/docs/hub/en/security-tokens).
3. Save it for the `.env` step below.

### Gurobi license (optional)

BrickGPT uses Gurobi for physics-based stability analysis; without it, a simpler connectivity-based fallback is used. Free academic licenses are available at [gurobi.com/academia](https://www.gurobi.com/academia/academic-program-and-licenses/). Place the resulting `gurobi.lic` in your home directory.

---

## Setup

> The `BrickGPT` and `TripoSR` source trees under `bricklab-backend/external/` are vendored directly into this repo — no submodules to initialize.

### 1. Clone

```bash
git clone <repo-url>
cd bricklab
```

### 2. Download the SAM checkpoint

Required for image-to-3D segmentation (~2.5 GB):

```bash
curl -L https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth \
  -o bricklab-backend/external/sam_vit_h.pth
```

> BrickGPT and TripoSR weights are pulled automatically from Hugging Face on first use.

### 3. Install backend dependencies

```bash
cd bricklab-backend
uv sync
uv pip install segment-anything Pillow open3d trimesh
```

`uv sync` installs FastAPI, PyTorch, Transformers, PEFT, and Gurobi bindings. The second command adds the runtime libraries used by the image-to-3D pipeline.

### 4. Configure environment

Create `bricklab-backend/.env`:

```bash
HF_TOKEN=hf_...
```

### 5. Install frontend dependencies

```bash
cd ../bricklab-frontend
npm install
```

---

## Running

Open two terminals.

**Backend** (`bricklab-backend/`):

```bash
uv run serve
```

→ API at `http://localhost:8000`. Verify: `curl http://localhost:8000/health` should return `{"status":"ok"}`.

**Frontend** (`bricklab-frontend/`):

```bash
npm run dev
```

→ Open `http://localhost:3000`.

The first text-to-3D or image-to-3D request will be slow as model weights download and load into memory; subsequent requests are cached.

---

## Licenses & acknowledgements

BrickLab bundles or depends on the following third-party work. Their license texts must be retained in any redistribution.

### Vendored source

| Project | License | Bundled at |
|---|---|---|
| **BrickGPT** — Pun et al., *ICCV 2025* | MIT, © 2025 Ava Pun | `bricklab-backend/external/BrickGPT/LICENSE` |
| **TripoSR** — Tochilkin et al., 2024 | MIT, © 2024 Tripo AI & Stability AI | `bricklab-backend/external/TripoSR/LICENSE` |

### Model weights (downloaded at runtime)

| Model | License | Notes |
|---|---|---|
| [meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) | [Llama 3.2 Community License](https://www.llama.com/llama3_2/license/) | Gated; Meta acceptable-use policy applies. |
| [AvaLovelace/BrickGPT](https://huggingface.co/AvaLovelace/BrickGPT) (LoRA) | MIT | |
| [stabilityai/TripoSR](https://huggingface.co/stabilityai/TripoSR) | MIT | |
| [Segment Anything ViT-H](https://github.com/facebookresearch/segment-anything) | Apache 2.0 | Downloaded manually (step 2). |

### Training data (not bundled)

| Dataset | License |
|---|---|
| [AvaLovelace/StableText2Brick](https://huggingface.co/datasets/AvaLovelace/StableText2Brick) | CC BY 4.0 — used to train BrickGPT |

### Citations

Please cite the upstream papers when using BrickLab in academic work:

```bibtex
@inproceedings{pun2025brickgpt,
  title     = {Generating Physically Stable and Buildable Brick Structures from Text},
  author    = {Pun, Ava and Deng, Kangle and Liu, Ruixuan and Ramanan, Deva and Liu, Changliu and Zhu, Jun-Yan},
  booktitle = {ICCV},
  year      = {2025}
}

@article{tochilkin2024triposr,
  title   = {TripoSR: Fast 3D Object Reconstruction from a Single Image},
  author  = {Tochilkin, Dmitry and Pankratz, David and Liu, Zexiang and Huang, Zixuan and Letts, Adam and Li, Yangguang and Liang, Ding and Laforte, Christian and Jampani, Varun and Cao, Yan-Pei},
  journal = {arXiv:2403.02151},
  year    = {2024}
}

@article{kirillov2023segany,
  title   = {Segment Anything},
  author  = {Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
  journal = {arXiv:2304.02643},
  year    = {2023}
}
```
