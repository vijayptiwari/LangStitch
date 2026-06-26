"""The runtime that ties config + registry + graph together."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from .config import AppConfig, load_config
from .graph import GraphBuilder
from .registry import Registry, get_registry

__all__ = ["LangStitchApp"]


class LangStitchApp:
    """Application runtime built from the global registry and config files.

    Typical usage in generated ``main.py``::

        app = LangStitchApp.bootstrap()
        graph = app.build_graph()
        result = app.invoke({"messages": [...]})
    """

    def __init__(self, config: AppConfig, registry: Optional[Registry] = None) -> None:
        self.config = config
        self.registry = registry or get_registry()
        self._compiled: Any = None

    @classmethod
    def bootstrap(
        cls,
        root: Optional[str | os.PathLike[str]] = None,
        *,
        properties: Optional[str] = None,
        apply_env: bool = True,
    ) -> "LangStitchApp":
        config = load_config(root, properties=properties, apply_env=apply_env)
        return cls(config)

    def build_graph(self, *, compile: bool = True) -> Any:
        spec = self.registry.entrypoint_graph()
        if spec is None:
            raise RuntimeError(
                "No graph registered. Define one with @graph(entrypoint=True)."
            )
        built = spec.target()
        if isinstance(built, GraphBuilder):
            self._compiled = built.compile() if compile else built
        else:
            self._compiled = built
        return self._compiled

    def invoke(self, state: Dict[str, Any], **kwargs: Any) -> Any:
        if self._compiled is None:
            self.build_graph()
        if not hasattr(self._compiled, "invoke"):
            raise RuntimeError(
                "Compiled graph is not invokable. Install 'langstitch[graph]' and "
                "return a GraphBuilder or compiled StateGraph from your @graph."
            )
        return self._compiled.invoke(state, **kwargs)

    # ── base helpers (delegate to providers, using this app's config) ──
    def get_llm_provider(self, name: Optional[str] = None, **kwargs: Any) -> Any:
        from .providers import get_llm_provider

        return get_llm_provider(name, **kwargs)

    def get_http_client(self, service: Optional[str] = None, **kwargs: Any) -> Any:
        from .providers import get_http_client

        return get_http_client(service, **kwargs)

    def get_async_http_client(self, service: Optional[str] = None, **kwargs: Any) -> Any:
        from .providers import get_async_http_client

        return get_async_http_client(service, **kwargs)

    def get_logger(self, name: Optional[str] = None) -> Any:
        from .providers import get_logger

        return get_logger(name or self.config.name)

    def info(self) -> Dict[str, Any]:
        return {
            "app": self.config.name,
            "version": self.config.version,
            "root": str(self.config.root),
            "components": self.registry.summary(),
        }
