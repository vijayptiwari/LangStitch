"""Tests for tracing, logging, and LangSmith graph registration."""
from __future__ import annotations

import json
import logging
import os
from unittest.mock import MagicMock, patch

import pytest

from langstitch.tracing import (
    TracingConfig,
    configure_tracing,
    get_correlation_id,
    get_tracing_config,
    log_event,
    register_graph,
    registered_graphs,
    reset_tracing,
    set_correlation_id,
    trace_node,
    traced_invoke,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_tracing()
    yield
    reset_tracing()


def test_configure_tracing_disabled_by_default():
    cfg = configure_tracing(force=True)
    assert cfg.enabled is False
    assert cfg.project == "langstitch"


def test_configure_tracing_from_env(monkeypatch):
    monkeypatch.setenv("LANGSMITH_API_KEY", "test-key")
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    monkeypatch.setenv("LANGCHAIN_PROJECT", "my-project")
    cfg = configure_tracing(force=True)
    assert cfg.langsmith_available is True
    assert cfg.project == "my-project"
    assert os.environ.get("LANGCHAIN_API_KEY") == "test-key"


def test_json_log_format(monkeypatch):
    monkeypatch.setenv("LOG_FORMAT", "json")
    cfg = configure_tracing(force=True)
    assert cfg.log_format == "json"


def test_register_graph_local_only():
    cfg = configure_tracing(force=True)
    assert not cfg.langsmith_available
    record = register_graph("demo", description="Demo graph", graph_structure={"nodes": ["a"]})
    assert record["name"] == "demo"
    assert record["langsmith"] is False
    assert "demo" in registered_graphs()


def test_register_graph_with_langsmith(monkeypatch):
    monkeypatch.setenv("LANGSMITH_API_KEY", "test-key")
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    configure_tracing(force=True)

    mock_client = MagicMock()
    mock_client.has_project.return_value = False
    mock_session = MagicMock(id="proj-1", url="https://smith.example/p")
    mock_client.create_project.return_value = mock_session

    with patch("langstitch.tracing.get_langsmith_client", return_value=mock_client):
        record = register_graph("demo", description="Demo")

    assert record["langsmith"] is True
    assert record["project_id"] == "proj-1"
    mock_client.create_project.assert_called_once()


def test_traced_invoke_without_langsmith():
    graph = MagicMock()
    graph.invoke.return_value = {"ok": True}
    configure_tracing(force=True)
    result = traced_invoke(graph, {"x": 1}, run_name="test")
    assert result == {"ok": True}
    graph.invoke.assert_called_once_with({"x": 1})


def test_traced_invoke_with_langsmith(monkeypatch):
    pytest.importorskip("langsmith")
    monkeypatch.setenv("LANGSMITH_API_KEY", "test-key")
    monkeypatch.setenv("LANGCHAIN_TRACING_V2", "true")
    configure_tracing(force=True)

    graph = MagicMock()
    graph.invoke.return_value = {"done": True}

    with patch("langsmith.traceable", side_effect=lambda **kw: (lambda fn: fn)):
        result = traced_invoke(graph, {"a": 1}, run_name="run1")

    assert result == {"done": True}


def test_trace_node_passthrough_when_disabled():
    configure_tracing(force=True)

    @trace_node
    def handler(state):
        return {"v": state["x"] + 1}

    assert handler({"x": 2}) == {"v": 3}


def test_correlation_id():
    set_correlation_id(None)
    a = get_correlation_id()
    b = get_correlation_id()
    assert a == b
    set_correlation_id("fixed")
    assert get_correlation_id() == "fixed"
