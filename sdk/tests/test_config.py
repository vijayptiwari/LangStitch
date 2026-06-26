"""application.yaml + env.yaml loading and @configuration binding."""
import os
from dataclasses import dataclass

from langstitch import configuration, load_config, load_env
from langstitch.config import find_project_root


def _write_project(tmp_path):
    (tmp_path / "application.yaml").write_text(
        """
app:
  name: demo
  version: 1.2.3
server:
  host: 127.0.0.1
  port: 9001
""".strip(),
        encoding="utf-8",
    )
    (tmp_path / "env.yaml").write_text(
        """
log_level: DEBUG
openai:
  api_key: sk-test
""".strip(),
        encoding="utf-8",
    )


def test_find_root_and_load(tmp_path):
    _write_project(tmp_path)
    assert find_project_root(tmp_path) == tmp_path.resolve()

    cfg = load_config(tmp_path)
    assert cfg.name == "demo"
    assert cfg.version == "1.2.3"
    assert cfg.get("server.port") == 9001
    assert cfg.get("missing.key", "fallback") == "fallback"


def test_env_flattening(tmp_path, monkeypatch):
    _write_project(tmp_path)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LOG_LEVEL", raising=False)

    applied = load_env(tmp_path)
    assert applied["OPENAI_API_KEY"] == "sk-test"
    assert os.environ["LOG_LEVEL"] == "DEBUG"


def test_configuration_binding(tmp_path):
    _write_project(tmp_path)

    @configuration(section="server")
    @dataclass
    class ServerConfig:
        host: str = "0.0.0.0"
        port: int = 8000

    load_config(tmp_path)
    inst = ServerConfig._langstitch_instance
    assert inst.host == "127.0.0.1"
    assert inst.port == 9001
    assert isinstance(inst.port, int)
