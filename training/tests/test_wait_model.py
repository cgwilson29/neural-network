"""Checks for the training module and the artifacts the notebook writes for the web exhibit.

Run from training/:  uv run pytest -q
"""

import json
import sys
from pathlib import Path

import numpy as np
import pytest
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import wait_model as wm  # noqa: E402

DATA_OUT = wm.WEB_DATA
ONNX_PATH = wm.WEB_PUBLIC / "model" / "wait_mlp.onnx"


@pytest.fixture(scope="module")
def splits():
    df = wm.load_data()
    return df, *wm.split_data(df)


def test_split_sizes_and_disjoint(splits):
    df, train, val, test = splits
    assert (len(train), len(val), len(test)) == (1400, 300, 300)
    assert set(train.index).isdisjoint(test.index)
    assert set(val.index).isdisjoint(test.index)
    assert set(train.index).isdisjoint(val.index)


def test_torch_encoding_matches_numpy_reference(splits):
    _, train, _, _ = splits
    scaling = wm.Scaling.from_train(train)
    model = wm.ExhibitModel(scaling)
    x = wm.grid_inputs()
    enc_torch = model.encode(torch.as_tensor(x)).numpy()
    enc_np = wm.encode_numpy(x, scaling)
    assert enc_torch.shape == (5250, 17)
    np.testing.assert_allclose(enc_torch, enc_np, atol=1e-5)
    # exactly one hot hour and one hot day per row
    assert np.all(enc_np[:, :10].sum(axis=1) == 1)
    assert np.all(enc_np[:, 10:15].sum(axis=1) == 1)


def test_grid_order_is_hour_day_staff_queue():
    g = wm.grid_inputs()
    assert g.shape == (5250, 4)
    assert g[0].tolist() == [8, 0, 1, 0]
    assert g[1].tolist() == [8, 0, 1, 1]
    assert g[21].tolist() == [8, 0, 2, 0]
    assert g[-1].tolist() == [17, 4, 5, 20]


@pytest.mark.skipif(not ONNX_PATH.exists(), reason="run the notebook first")
def test_onnx_matches_grid_json_and_is_self_contained():
    assert ONNX_PATH.stat().st_size > 5_000  # weights embedded, not external
    assert not list(ONNX_PATH.parent.glob("*.data"))
    out = wm.ort_run(ONNX_PATH, wm.grid_inputs())
    grid = json.loads((DATA_OUT / "grid_predictions.json").read_text())
    np.testing.assert_allclose(out["wait_minutes"].ravel(), grid["wait"], atol=0.006)
    assert out["h1"].shape[0] == 5250 and out["h2"].shape[0] == 5250
    assert (out["wait_minutes"] >= 0).all()


@pytest.mark.skipif(not (DATA_OUT / "metrics.json").exists(), reason="run the notebook first")
def test_artifacts_are_complete():
    metrics = json.loads((DATA_OUT / "metrics.json").read_text())
    assert metrics["dataset"]["synthetic"] is True
    assert set(metrics["models"]) == {"median_baseline", "linear", "ratio_formula", "nn"}
    assert metrics["headline"]["nnMae"] < metrics["headline"]["baselineMae"]
    assert "<<" not in metrics["biggestMiss"]["explanation"]
    tp = json.loads((DATA_OUT / "test_predictions.json").read_text())
    assert len(tp["rows"]) == 300 and len(tp["columns"]) == len(tp["rows"][0])
    assert tp["biggestMissId"] in {row[0] for row in tp["rows"]}
    for path in [*(DATA_OUT / f"{n}.json" for n in ["model_card", "training_history", "grid_predictions"]), wm.WEB_FIXTURES / "parity_fixtures.json"]:
        text = path.read_text()
        assert "NaN" not in text and "Infinity" not in text
