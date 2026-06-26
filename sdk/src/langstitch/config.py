"""Configuration loading for LangStitch applications.

Two files drive a LangStitch app, both resolved from the *project root*:

* ``application.yaml`` — declarative application configuration (app metadata,
  models, graph wiring, server settings, and arbitrary user sections).
* ``env.yaml`` — runtime environment variables. Values here are exported into
  ``os.environ`` (without clobbering anything already set) so secrets/config can
  live outside code while still being read via ``os.getenv``.

``@configuration`` binds a section of ``application.yaml`` onto a dataclass-like
class so app code gets typed access instead of dict spelunking.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import yaml

from ._decorators import resolve_name
from .registry import ConfigurationSpec, get_registry

__all__ = [
    "AppConfig",
    "configuration",
    "load_application_config",
    "load_env",
    "load_config",
    "find_project_root",
    "query_json",
    "compile_config",
]

APPLICATION_FILE = "application.yaml"
APPLICATION_JSON = "application.json"
ENV_FILE = "env.yaml"
_ROOT_MARKERS = (APPLICATION_JSON, APPLICATION_FILE, "pyproject.toml", ".git")


def query_json(data: Any, path: Optional[str], default: Any = None) -> Any:
    """Resolve a JSON path against an in-memory object.

    Supports a pragmatic JSONPath-lite syntax:

    * dotted keys — ``server.port``
    * array indices — ``items[0].name`` (negative indices allowed)
    * an optional leading ``$`` / ``$.`` root marker

    Returns the value (which may itself be a dict/list) or ``default`` if any
    segment is missing. An empty/``$`` path returns the whole object.
    """
    if path is None or path in ("", "$", ".", "$."):
        return data
    node = data
    for token in _tokenize_path(path):
        if isinstance(token, int):
            if isinstance(node, list) and -len(node) <= token < len(node):
                node = node[token]
            else:
                return default
        else:
            if isinstance(node, dict) and token in node:
                node = node[token]
            else:
                return default
    return node


_INDEX_RE = re.compile(r"[^\[\]]+|\[-?\d+\]")


def _tokenize_path(path: str) -> List[Union[str, int]]:
    path = path.strip()
    if path.startswith("$"):
        path = path[1:]
    if path.startswith("."):
        path = path[1:]
    tokens: List[Union[str, int]] = []
    for part in path.split("."):
        if not part:
            continue
        for piece in _INDEX_RE.findall(part):
            if piece.startswith("[") and piece.endswith("]"):
                tokens.append(int(piece[1:-1]))
            else:
                tokens.append(piece)
    return tokens


def find_project_root(start: Optional[os.PathLike[str] | str] = None) -> Path:
    """Walk upward from ``start`` (or CWD) to locate the project root.

    The root is the nearest ancestor containing ``application.yaml`` (preferred),
    else ``pyproject.toml`` / ``.git``. Falls back to the starting directory.
    """
    cur = Path(start or Path.cwd()).resolve()
    if cur.is_file():
        cur = cur.parent
    best: Optional[Path] = None
    for parent in [cur, *cur.parents]:
        if (parent / APPLICATION_JSON).exists() or (parent / APPLICATION_FILE).exists():
            return parent
        if best is None and any((parent / m).exists() for m in _ROOT_MARKERS):
            best = parent
    return best or cur


def _read_config_file(base: Path) -> tuple[Dict[str, Any], Optional[Path]]:
    """Load the application config from ``application.json`` (preferred — already
    JSON, no conversion) or ``application.yaml``. Returns (data, source path)."""
    json_path = base / APPLICATION_JSON
    if json_path.exists():
        with json_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh) or {}
        if not isinstance(data, dict):
            raise ValueError(f"{APPLICATION_JSON} must contain a JSON object at the top level")
        return data, json_path
    yaml_path = base / APPLICATION_FILE
    return _read_yaml(yaml_path), (yaml_path if yaml_path.exists() else None)


def _read_config_path(path: Path) -> Dict[str, Any]:
    """Read a specific config file, choosing the parser by extension."""
    if not path.exists():
        raise FileNotFoundError(f"properties file not found: {path}")
    if path.suffix.lower() == ".json":
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh) or {}
    else:  # .yaml / .yml / anything else -> YAML (a superset of JSON)
        data = _read_yaml(path)
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a mapping/object at the top level")
    return data


def _read_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a YAML mapping at the top level")
    return data


@dataclass
class AppConfig:
    """Parsed application config (the in-memory JSON runtime store).

    ``raw`` is the precompiled config object; ``query``/``get``/``as_json`` run
    JSON-path lookups against it.
    """

    root: Path
    raw: Dict[str, Any] = field(default_factory=dict)
    source: Optional[Path] = None

    @property
    def name(self) -> str:
        app = self.raw.get("app", {})
        return app.get("name", self.root.name)

    @property
    def version(self) -> str:
        return self.raw.get("app", {}).get("version", "0.1.0")

    @property
    def description(self) -> str:
        return self.raw.get("app", {}).get("description", "")

    def section(self, key: str, default: Any = None) -> Any:
        return self.raw.get(key, default)

    def get(self, dotted: str, default: Any = None) -> Any:
        """Read a nested value via JSON path, e.g. ``server.port``."""
        return query_json(self.raw, dotted, default)

    def query(self, path: Optional[str], default: Any = None) -> Any:
        """Resolve a JSON path against the precompiled config object."""
        return query_json(self.raw, path, default)

    def as_json(self, path: Optional[str] = None, *, indent: Optional[int] = None) -> str:
        """Return the config (or the value at ``path``) serialized as JSON."""
        data = self.raw if path is None else self.query(path)
        return json.dumps(data, indent=indent, default=str)


def load_application_config(
    root: Optional[os.PathLike[str] | str] = None,
    *,
    properties: Optional[str] = None,
) -> AppConfig:
    """Load the application config.

    ``properties`` is a path to a specific config file (``.json`` or ``.yaml``),
    absolute or relative to the project root. When omitted, the loader discovers
    ``application.json`` (preferred) then ``application.yaml`` at the root.
    """
    base = find_project_root(root)
    if properties:
        path = Path(properties)
        if not path.is_absolute():
            path = base / path
        return AppConfig(root=base, raw=_read_config_path(path), source=path)
    raw, source = _read_config_file(base)
    return AppConfig(root=base, raw=raw, source=source)


def compile_config(root: Optional[os.PathLike[str] | str] = None, *, indent: int = 2) -> Path:
    """Compile ``application.yaml`` into ``application.json`` for fast startup.

    Returns the path written. After this, the runtime loads the JSON directly
    with no YAML→JSON conversion.
    """
    base = find_project_root(root)
    data = _read_yaml(base / APPLICATION_FILE)
    out = base / APPLICATION_JSON
    out.write_text(json.dumps(data, indent=indent), encoding="utf-8")
    return out


def load_env(root: Optional[os.PathLike[str] | str] = None, *, override: bool = False) -> Dict[str, str]:
    """Load ``env.yaml`` into ``os.environ`` and return the applied mapping.

    Nested mappings are flattened to ``UPPER_SNAKE`` keys (``db.host`` ->
    ``DB_HOST``). Existing environment values win unless ``override`` is True.
    """
    base = find_project_root(root)
    raw = _read_yaml(base / ENV_FILE)
    flat = _flatten_env(raw)
    applied: Dict[str, str] = {}
    for key, value in flat.items():
        if override or key not in os.environ:
            os.environ[key] = value
            applied[key] = value
    return applied


def _flatten_env(data: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    for key, value in data.items():
        env_key = f"{prefix}{key}".upper().replace("-", "_").replace(".", "_")
        if isinstance(value, dict):
            out.update(_flatten_env(value, prefix=f"{env_key}_"))
        elif value is None:
            out[env_key] = ""
        elif isinstance(value, bool):
            out[env_key] = "true" if value else "false"
        else:
            out[env_key] = str(value)
    return out


_ACTIVE_CONFIG: Optional[AppConfig] = None


def load_config(
    root: Optional[os.PathLike[str] | str] = None,
    *,
    properties: Optional[str] = None,
    apply_env: bool = True,
    override_env: bool = False,
) -> AppConfig:
    """Load env (optional) then application config. Primary entrypoint.

    ``properties`` selects a specific config file (see
    :func:`load_application_config`). The result becomes the *active* config
    returned by the runtime helpers (``langstitch.get_config`` and the
    provider/service functions).
    """
    global _ACTIVE_CONFIG
    if apply_env:
        load_env(root, override=override_env)
    cfg = load_application_config(root, properties=properties)
    _bind_configurations(cfg)
    _ACTIVE_CONFIG = cfg
    return cfg


def get_active_config() -> Optional[AppConfig]:
    return _ACTIVE_CONFIG


def clear_active_config() -> None:
    global _ACTIVE_CONFIG
    _ACTIVE_CONFIG = None


def _coerce(value: Any, annotation: Any) -> Any:
    if annotation in (int, float, str, bool) and value is not None:
        try:
            if annotation is bool and isinstance(value, str):
                return value.strip().lower() in {"1", "true", "yes", "on"}
            return annotation(value)
        except (TypeError, ValueError):
            return value
    return value


def _bind_configurations(cfg: AppConfig) -> None:
    """Populate registered ``@configuration`` classes from application.yaml."""
    for spec in get_registry().configurations.values():
        cls = spec.target
        data = cfg.section(spec.section, {}) or {}
        if not isinstance(data, dict):
            continue
        values: Dict[str, Any] = {}
        if is_dataclass(cls):
            ann = {f.name: f.type for f in fields(cls)}
        else:
            ann = getattr(cls, "__annotations__", {})
        for fname, ftype in ann.items():
            if fname in data:
                values[fname] = _coerce(data[fname], ftype)
        instance = cls(**values) if values else cls()
        # expose the bound instance on the class for easy retrieval
        setattr(cls, "_langstitch_instance", instance)
        spec.metadata["instance"] = instance


def configuration(
    _target: Any = None,
    /,
    *,
    section: Optional[str] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
):
    """Bind a class to a section of ``application.yaml``.

    Usage::

        @configuration(section="server")
        @dataclass
        class ServerConfig:
            host: str = "0.0.0.0"
            port: int = 8000

    After :func:`load_config`, ``ServerConfig._langstitch_instance`` holds the
    populated instance.
    """

    def wrap(cls: Any) -> Any:
        spec = ConfigurationSpec(
            name=resolve_name(cls, name),
            target=cls,
            description=description or (cls.__doc__ or "").strip().splitlines()[0] if cls.__doc__ else "",
            section=section or resolve_name(cls, name).lower(),
        )
        get_registry().add_configuration(spec)
        return cls

    if _target is not None:
        return wrap(_target)
    return wrap
