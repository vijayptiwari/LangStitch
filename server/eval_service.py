"""LangSmith eval orchestration for LangStitch platform API."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any


@dataclass
class EvalConfigInput:
    dataset_name: str = ""
    dataset_id: str = ""
    experiment_prefix: str = ""
    max_concurrency: int = 2
    description: str = ""
    enabled: bool = True


def _dataset_ref(config: EvalConfigInput) -> str:
    return (config.dataset_name or config.dataset_id or "").strip()


def run_eval_job(
    config: EvalConfigInput,
    *,
    langsmith_project: str,
    api_key_env: str = "LANGCHAIN_API_KEY",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Run or validate a LangSmith eval job."""
    started = time.perf_counter()
    dataset = _dataset_ref(config)
    if not dataset:
        return {"ok": False, "message": "dataset_name or dataset_id is required", "latency_ms": 0}

    api_key = os.environ.get(api_key_env)
    if not api_key and not dry_run:
        return {
            "ok": False,
            "message": f"Missing API key — set {api_key_env} in the platform API environment",
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "dataset": dataset,
            "experiment_prefix": config.experiment_prefix or langsmith_project,
            "message": "Eval config validated (dry run)",
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }

    try:
        from langsmith import Client
        from langsmith.evaluation import evaluate
    except ImportError as exc:
        return {
            "ok": False,
            "message": "langsmith package not installed on platform API host",
            "detail": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }

    def target(inputs: dict[str, Any]) -> dict[str, Any]:
        return {"output": "langstitch-eval-stub", "inputs": inputs}

    client = Client()
    prefix = config.experiment_prefix or langsmith_project or "langstitch-eval"
    try:
        results = evaluate(
            target,
            data=dataset,
            experiment_prefix=prefix,
            max_concurrency=min(max(config.max_concurrency, 1), 8),
            client=client,
            description=config.description or None,
        )
        experiment_id = getattr(results, "experiment_name", None) or str(results)
        url = f"https://smith.langchain.com/o/default/datasets"
        return {
            "ok": True,
            "experiment_id": experiment_id,
            "url": url,
            "message": f"Eval started for dataset {dataset}",
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "result": json.loads(json.dumps(str(results), default=str)) if False else str(results),
        }
    except Exception as exc:  # noqa: BLE001 — surface LangSmith errors to UI
        return {
            "ok": False,
            "message": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000),
        }
