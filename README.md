# BrickLab

| Layer    | Stack                                  | Port |
| -------- | -------------------------------------- | ---- |
| Frontend | Next.js 16 + React 19 + Three.js (R3F) | 3000 |
| Backend  | FastAPI + Uvicorn (Python ≥ 3.10)      | 8000 |

---

## Prerequisites

- **Node.js** ≥ 18 + **npm**
- **Python** ≥ 3.10
- **uv**: [install](https://docs.astral.sh/uv/getting-started/installation/)
- **Hugging Face token**: BrickGPT is fine-tuned from the gated [meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) model. [Request access](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct), then generate a [user access token](https://huggingface.co/docs/hub/en/security-tokens).
- **Gurobi license** _(optional)_: used for physics-based stability analysis; a connectivity-based fallback is used without it. Free academic licenses at [gurobi.com/academia](https://www.gurobi.com/academia/academic-program-and-licenses/). Place `gurobi.lic` in your home directory.

---

## Setup

### 1. Clone

```bash
git clone <repo-url>
cd bricklab
```

> The BrickGPT and TripoSR source trees are vendored into `bricklab-backend/external/`. No submodules to initialize.

### 2. Download Segment Anything model weights (~2.5 GB)

Required for image-to-3D segmentation:

```bash
curl -L https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth \
  -o bricklab-backend/external/sam_vit_h.pth
```

BrickGPT and TripoSR weights download automatically from Hugging Face on first use.

### 3. Install backend dependencies

```bash
cd bricklab-backend
uv sync
uv pip install segment-anything Pillow open3d trimesh
```

`uv sync` installs FastAPI, PyTorch, Transformers, PEFT, and Gurobi bindings. The second command adds libraries for the image-to-3D pipeline.

### 4. Configure environment

Create `bricklab-backend/.env`:

```
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

Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

**Frontend** (`bricklab-frontend/`):

```bash
npm run dev
```

Open `http://localhost:3000`.

> The first text-to-3D or image-to-3D request will be slow as model weights download and load into memory; subsequent requests are cached.

---

## Licenses & acknowledgements

### Vendored source

The following projects are copied directly into `bricklab-backend/external/`. Their license texts must be retained in any redistribution.

| Project                               | License | Path                                         |
| ------------------------------------- | ------- | -------------------------------------------- |
| **BrickGPT**: Pun et al., _ICCV 2025_ | MIT     | `bricklab-backend/external/BrickGPT/LICENSE` |
| **TripoSR**: Tochilkin et al., 2024   | MIT     | `bricklab-backend/external/TripoSR/LICENSE`  |

### Model weights (downloaded at runtime)

| Model                                                                                       | License                                                                                                           |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [meta-llama/Llama-3.2-1B-Instruct](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) | [Llama 3.2 Community License](https://www.llama.com/llama3_2/license/): gated; Meta acceptable-use policy applies |
| [AvaLovelace/BrickGPT](https://huggingface.co/AvaLovelace/BrickGPT) (LoRA)                  | MIT                                                                                                               |
| [stabilityai/TripoSR](https://huggingface.co/stabilityai/TripoSR)                           | MIT                                                                                                               |
| [Segment Anything (ViT-H)](https://github.com/facebookresearch/segment-anything)            | Apache 2.0                                                                                                        |

### Training data

The [AvaLovelace/StableText2Brick](https://huggingface.co/datasets/AvaLovelace/StableText2Brick) dataset (CC BY 4.0) was used to train BrickGPT and is not included in this repo.

### Citations

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
  journal = {arXiv preprint arXiv:2403.02151},
  year    = {2024}
}

@article{kirillov2023segany,
  title   = {Segment Anything},
  author  = {Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
  journal = {arXiv preprint arXiv:2304.02643},
  year    = {2023}
}
```
