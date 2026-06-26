"""get_config(path), application.json precompiled store, and compile."""
import json

from langstitch import (
    compile_config,
    get_config,
    load_config,
    query_json,
)


def test_query_json_paths():
    data = {
        "server": {"port": 8000, "hosts": ["a", "b"]},
        "items": [{"name": "x"}, {"name": "y"}],
    }
    assert query_json(data, "server.port") == 8000
    assert query_json(data, "$.server.port") == 8000
    assert query_json(data, "server.hosts[1]") == "b"
    assert query_json(data, "items[0].name") == "x"
    assert query_json(data, "items[-1].name") == "y"
    assert query_json(data, "server") == {"port": 8000, "hosts": ["a", "b"]}
    assert query_json(data, "missing.key", "def") == "def"
    assert query_json(data, "") is data


def _write_yaml(tmp_path):
    (tmp_path / "application.yaml").write_text(
        """
app:
  name: demo
server:
  host: 127.0.0.1
  port: 9001
external_services:
  payments:
    auth:
      type: bearer
""".strip(),
        encoding="utf-8",
    )


def test_get_config_path_value_and_object(tmp_path):
    _write_yaml(tmp_path)
    load_config(tmp_path)  # sets the active runtime store

    assert get_config("server.port") == 9001
    assert get_config("external_services.payments.auth.type") == "bearer"
    assert get_config("server") == {"host": "127.0.0.1", "port": 9001}
    assert get_config("nope.path", default="fallback") == "fallback"

    # whole AppConfig when no path
    cfg = get_config()
    assert cfg.name == "demo"


def test_get_config_as_json(tmp_path):
    _write_yaml(tmp_path)
    load_config(tmp_path)
    raw = get_config("server", as_json=True)
    assert json.loads(raw) == {"host": "127.0.0.1", "port": 9001}


def test_compile_and_prefer_json(tmp_path):
    _write_yaml(tmp_path)
    out = compile_config(tmp_path)
    assert out.name == "application.json"
    assert (tmp_path / "application.json").exists()

    # Now mutate the YAML; the precompiled JSON must take precedence on load.
    (tmp_path / "application.yaml").write_text("app:\n  name: changed\n", encoding="utf-8")
    cfg = load_config(tmp_path)
    assert cfg.source.name == "application.json"
    assert cfg.name == "demo"  # from JSON, not the changed YAML
    assert get_config("server.port") == 9001


def test_application_json_direct(tmp_path):
    (tmp_path / "application.json").write_text(
        json.dumps({"app": {"name": "jsonapp"}, "server": {"port": 1234}}),
        encoding="utf-8",
    )
    cfg = load_config(tmp_path)
    assert cfg.source.name == "application.json"
    assert cfg.name == "jsonapp"
    assert get_config("server.port") == 1234
