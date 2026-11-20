"""Training, evaluation and export helpers for the Queue Cartography exhibit.

The notebook (train_wait_model.ipynb) tells the story; this module holds the reusable
pieces so they can also be unit-tested (tests/test_wait_model.py).

Inputs  (raw, exactly what a visitor sets on the site):
    hour            int 8..17
    day_idx         int 0..4  (Mon..Fri)
    staff_on_shift  int 1..5
    patients_in_queue int 0..20
Output: predicted wait in minutes.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from torch import nn

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "clinic-wait-times.csv"
WEB_PUBLIC = ROOT / "web" / "public"  # ONNX model (served as a static file)
WEB_DATA = ROOT / "web" / "src" / "data"  # JSON bundled into the site
WEB_FIXTURES = ROOT / "web" / "tests" / "fixtures"  # parity fixtures for vitest
DATA_SOURCE_URL = "https://snsie.github.io/neural-networks/data/clinic-wait-times.csv"

SEED = 42
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]
HOURS = list(range(8, 18))  # 8..17
STAFF = list(range(1, 6))  # 1..5
QUEUE = list(range(0, 21))  # 0..20
INPUT_COLUMNS = ["hour", "day_idx", "staff_on_shift", "patients_in_queue"]
TARGET = "wait_minutes"
FEATURE_NAMES = (
    [f"hour_{h}" for h in HOURS]
    + [f"day_{d}" for d in DAYS]
    + ["staff_on_shift (std)", "patients_in_queue (std)"]
)


# --------------------------------------------------------------------------- data
def file_sha256(path: Path = DATA_PATH) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_data(path: Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)
    unknown = set(df["day_of_week"]) - set(DAYS)
    if unknown:
        raise ValueError(f"Unexpected day labels: {unknown}")
    df["day_idx"] = df["day_of_week"].map({d: i for i, d in enumerate(DAYS)}).astype(int)
    return df


def split_data(df: pd.DataFrame, seed: int = SEED):
    """70/15/15 split, stratified by staff_on_shift. Returns (train, val, test)."""
    train, temp = train_test_split(
        df, test_size=0.30, stratify=df["staff_on_shift"], random_state=seed
    )
    val, test = train_test_split(
        temp, test_size=0.50, stratify=temp["staff_on_shift"], random_state=seed
    )
    return train.copy(), val.copy(), test.copy()


def inputs(df: pd.DataFrame) -> np.ndarray:
    """Raw model inputs [N,4] float32 in INPUT_COLUMNS order."""
    return np.array(df[INPUT_COLUMNS].to_numpy(dtype=np.float32), copy=True)


def target(df: pd.DataFrame) -> np.ndarray:
    return np.array(df[TARGET].to_numpy(dtype=np.float32), copy=True)


@dataclass
class Scaling:
    num_mean: list[float]  # [staff, queue]
    num_std: list[float]
    y_mean: float
    y_std: float

    @classmethod
    def from_train(cls, train: pd.DataFrame) -> "Scaling":
        num = train[["staff_on_shift", "patients_in_queue"]].to_numpy(dtype=np.float64)
        y = train[TARGET].to_numpy(dtype=np.float64)
        return cls(
            num_mean=num.mean(axis=0).tolist(),
            num_std=num.std(axis=0).tolist(),
            y_mean=float(y.mean()),
            y_std=float(y.std()),
        )


def encode_numpy(x: np.ndarray, scaling: Scaling) -> np.ndarray:
    """Reference (non-torch) encoding: one-hot hour (10) + one-hot day (5) + 2 standardized."""
    x = np.asarray(x, dtype=np.float64)
    hour = np.rint(x[:, 0:1])
    day = np.rint(x[:, 1:2])
    hour_oh = (hour == np.array(HOURS, dtype=np.float64)[None, :]).astype(np.float64)
    day_oh = (day == np.arange(5, dtype=np.float64)[None, :]).astype(np.float64)
    num = (x[:, 2:4] - np.array(scaling.num_mean)) / np.array(scaling.num_std)
    return np.concatenate([hour_oh, day_oh, num], axis=1)


# --------------------------------------------------------------------------- model
class ExhibitModel(nn.Module):
    """MLP with preprocessing baked in, so the exported ONNX graph takes raw inputs.

    forward(x) -> (wait_minutes [N,1], h1 [N,H1], h2 [N,H2])
    """

    def __init__(self, scaling: Scaling, hidden: tuple[int, int] = (16, 8)):
        super().__init__()
        self.hidden = hidden
        self.register_buffer("hours", torch.tensor([HOURS], dtype=torch.float32))
        self.register_buffer("days", torch.arange(5, dtype=torch.float32)[None, :])
        self.register_buffer("num_mean", torch.tensor([scaling.num_mean], dtype=torch.float32))
        self.register_buffer("num_std", torch.tensor([scaling.num_std], dtype=torch.float32))
        self.register_buffer("y_mean", torch.tensor(scaling.y_mean, dtype=torch.float32))
        self.register_buffer("y_std", torch.tensor(scaling.y_std, dtype=torch.float32))
        self.l1 = nn.Linear(len(FEATURE_NAMES), hidden[0])
        self.l2 = nn.Linear(hidden[0], hidden[1])
        self.out = nn.Linear(hidden[1], 1)

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        hour = torch.round(x[:, 0:1])
        day = torch.round(x[:, 1:2])
        return torch.cat(
            [
                (hour == self.hours).float(),
                (day == self.days).float(),
                (x[:, 2:4] - self.num_mean) / self.num_std,
            ],
            dim=1,
        )

    def forward_z(self, x: torch.Tensor):
        a1 = torch.relu(self.l1(self.encode(x)))
        a2 = torch.relu(self.l2(a1))
        return self.out(a2), a1, a2

    def forward(self, x: torch.Tensor):
        z, a1, a2 = self.forward_z(x)
        wait = torch.clamp(z * self.y_std + self.y_mean, min=0.0)
        return wait, a1, a2

    @torch.no_grad()
    def predict(self, x: np.ndarray) -> np.ndarray:
        self.eval()
        return self(torch.as_tensor(x, dtype=torch.float32))[0].numpy().ravel()


@dataclass
class TrainConfig:
    hidden: tuple[int, int] = (16, 8)
    lr: float = 1e-3
    weight_decay: float = 0.0
    batch_size: int = 64
    max_epochs: int = 3000
    patience: int = 150
    seed: int = SEED


@dataclass
class TrainResult:
    model: ExhibitModel
    config: TrainConfig
    best_epoch: int
    epochs_run: int
    best_val_mae: float
    history: dict = field(default_factory=dict)


def set_determinism(seed: int = SEED) -> None:
    torch.manual_seed(seed)
    np.random.seed(seed)
    torch.use_deterministic_algorithms(True)
    torch.set_num_threads(1)  # tiny network: one thread is fastest and fully reproducible


def train_mlp(
    train: pd.DataFrame, val: pd.DataFrame, scaling: Scaling, cfg: TrainConfig
) -> TrainResult:
    """Adam + MSE on the standardized target, early stopping on validation MAE (minutes)."""
    set_determinism(cfg.seed)
    model = ExhibitModel(scaling, cfg.hidden)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss()

    x_tr = torch.as_tensor(inputs(train))
    z_tr = torch.as_tensor((target(train) - scaling.y_mean) / scaling.y_std)[:, None]
    x_va = torch.as_tensor(inputs(val))
    y_va = target(val)
    gen = torch.Generator().manual_seed(cfg.seed)
    n = len(x_tr)

    best_mae, best_epoch, best_state = math.inf, 0, None
    hist = {"epoch": [], "trainLoss": [], "valMae": []}
    epoch = 0
    for epoch in range(1, cfg.max_epochs + 1):
        model.train()
        perm = torch.randperm(n, generator=gen)
        total = 0.0
        for i in range(0, n, cfg.batch_size):
            idx = perm[i : i + cfg.batch_size]
            z, _, _ = model.forward_z(x_tr[idx])
            loss = loss_fn(z, z_tr[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        model.eval()
        with torch.no_grad():
            val_pred = model(x_va)[0].numpy().ravel()
        val_mae = float(np.mean(np.abs(val_pred - y_va)))
        hist["epoch"].append(epoch)
        hist["trainLoss"].append(total / n)
        hist["valMae"].append(val_mae)
        if val_mae < best_mae - 1e-4:
            best_mae, best_epoch = val_mae, epoch
            best_state = copy.deepcopy(model.state_dict())
        elif epoch - best_epoch >= cfg.patience:
            break

    assert best_state is not None
    model.load_state_dict(best_state)
    model.eval()
    hist["bestEpoch"] = best_epoch
    return TrainResult(model, cfg, best_epoch, epoch, best_mae, hist)


# --------------------------------------------------------------------------- metrics
def regression_metrics(y: np.ndarray, pred: np.ndarray) -> dict:
    y = np.asarray(y, dtype=np.float64)
    pred = np.asarray(pred, dtype=np.float64)
    err = pred - y
    ss_res = float(np.sum(err**2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    return {
        "mae": float(np.mean(np.abs(err))),
        "rmse": float(np.sqrt(np.mean(err**2))),
        "r2": 1.0 - ss_res / ss_tot,
        "within10": float(np.mean(np.abs(err) <= 10.0)),
    }


def bootstrap_mae(
    y: np.ndarray, preds: dict[str, np.ndarray], n_boot: int = 1000, seed: int = SEED
) -> dict[str, np.ndarray]:
    """Bootstrap distribution of MAE for each model (same resamples for every model)."""
    rng = np.random.default_rng(seed)
    y = np.asarray(y, dtype=np.float64)
    idx = rng.integers(0, len(y), size=(n_boot, len(y)))
    return {
        name: np.abs(np.asarray(p, dtype=np.float64)[idx] - y[idx]).mean(axis=1)
        for name, p in preds.items()
    }


def ci95(samples: np.ndarray) -> list[float]:
    lo, hi = np.percentile(samples, [2.5, 97.5])
    return [float(lo), float(hi)]


def residual_bands(y: np.ndarray, pred: np.ndarray, edges=(0, 30, 60, 120, math.inf)) -> list[dict]:
    """10th/90th percentile of (actual - predicted), binned by predicted wait (from validation)."""
    y = np.asarray(y, dtype=np.float64)
    pred = np.asarray(pred, dtype=np.float64)
    res = y - pred
    bands = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (pred >= lo) & (pred < hi)
        if m.sum() < 5:
            continue
        q10, q90 = np.percentile(res[m], [10, 90])
        bands.append(
            {
                "predMin": float(lo),
                "predMax": None if math.isinf(hi) else float(hi),
                "q10": r(q10),
                "q90": r(q90),
                "n": int(m.sum()),
            }
        )
    return bands


# --------------------------------------------------------------------------- grid + export
def grid_inputs() -> np.ndarray:
    """Every (hour, day, staff, queue) combination in that nesting order: 10*5*5*21 = 5250 rows."""
    rows = [
        (h, d, s, q)
        for h in HOURS
        for d in range(5)
        for s in STAFF
        for q in QUEUE
    ]
    return np.asarray(rows, dtype=np.float32)


def parity_inputs() -> np.ndarray:
    """Edge-case rows for browser/Node parity tests."""
    rows = [
        (h, d, s, q)
        for h in (8, 9, 13, 17)
        for d in (0, 4)
        for s in (1, 3, 5)
        for q in (0, 10, 20)
    ]
    return np.asarray(rows, dtype=np.float32)


def export_onnx(model: ExhibitModel, path: Path) -> Path:
    """Export to a single self-contained ONNX file (weights embedded)."""
    import logging

    # torchvision isn't installed (not needed); silence the exporter's notice about skipping its ops.
    logging.getLogger("torch.onnx._internal.exporter._registration").setLevel(logging.ERROR)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    example = torch.as_tensor(parity_inputs()[:8])
    torch.onnx.export(
        model,
        (example,),
        str(path),
        dynamo=True,
        opset_version=18,
        input_names=["x"],
        output_names=["wait_minutes", "h1", "h2"],
        dynamic_shapes={"x": {0: torch.export.Dim.DYNAMIC}},
        external_data=False,
        verbose=False,
    )
    return path


def ort_run(path: Path, x: np.ndarray) -> dict[str, np.ndarray]:
    import onnxruntime as ort

    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    outs = sess.run(None, {"x": np.asarray(x, dtype=np.float32)})
    names = [o.name for o in sess.get_outputs()]
    return dict(zip(names, outs))


def write_json(path: Path, obj, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=indent, allow_nan=False))


def r(x: float, nd: int = 2) -> float:
    return float(round(float(x), nd))
