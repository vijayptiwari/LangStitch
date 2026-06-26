"""`properties` config-file selection on the server decorators + loaders."""
import json

import pytest

from langstitch import (
    get_config,
    get_registry,
    langstitch_graph_server,
    langstitch_mcp_server,
    load_application_config,
    load_config,
)


def test_load_config_explicit_yaml(tmp_path):
    (tmp_path / "custom.yaml").write_text("app:\n  name: fromyaml\nserver:\n  port: 7000\n", encoding="utf-8")
    cfg = load_config(tmp_path, properties="custom.yaml")
    assert cfg.name == "fromyaml"
    assert cfg.source.name == "custom.yaml"
    assert get_config("server.port") == 7000


def test_load_config_explicit_json(tmp_path):
    (tmp_path / "conf.json").write_text(json.dumps({"app": {"name": "fromjson"}, "x": 1}), encoding="utf-8")
    cfg = load_config(tmp_path, properties="conf.json")
    assert cfg.name == "fromjson"
    assert get_config("x") == 1


def test_load_config_missing_properties_raises(tmp_path):
    with pytest.raises(FileNotFoundError, match="properties file not found"):
        load_application_config(tmp_path, properties="nope.yaml")


def test_default_prefers_json_over_yaml(tmp_path):
    (tmp_path / "application.yaml").write_text("app:\n  name: y\n", encoding="utf-8")
    (tmp_path / "application.json").write_text(json.dumps({"app": {"name": "j"}}), encoding="utf-8")
    cfg = load_config(tmp_path)  # no properties -> discover
    assert cfg.name == "j"
    assert cfg.source.name == "application.json"


def test_graph_server_properties_stored_and_loads(tmp_path):
    (tmp_path / "svc.yaml").write_text("app:\n  name: svccfg\nserver:\n  port: 8123\n", encoding="utf-8")

    @langstitch_graph_server(name="gs", properties="svc.yaml")
    class Server:
        pass

    spec = get_registry().server
    assert spec.properties == "svc.yaml"
    assert hasattr(Server, "load_config")  # classmethod attached
    # resolve relative to the project root explicitly
    cfg = load_config(tmp_path, properties=spec.properties)
    assert cfg.name == "svccfg"
    assert get_config("server.port") == 8123


def test_mcp_server_properties_stored(tmp_path):
    @langstitch_mcp_server(protocol="sse", properties="application.yaml")
    class MCP:
        pass

    spec = get_registry().mcp_server
    assert spec.properties == "application.yaml"
    assert hasattr(MCP, "load_config")


def test_default_properties_none(tmp_path):
    @langstitch_graph_server(name="gs2")
    class Server:
        pass

    assert get_registry().server.properties is None
