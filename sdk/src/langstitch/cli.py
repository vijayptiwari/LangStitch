"""``langstitch`` command-line interface.

Commands
--------
* ``langstitch new <name>``   scaffold a new project
* ``langstitch info``         load config + list registered components
* ``langstitch run``          start the API server (needs the ``server`` extra)
* ``langstitch version``      print the SDK version
"""
from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path
from typing import Optional

from ._version import __version__
from .scaffold import build_scaffold, slugify


def _cmd_new(args: argparse.Namespace) -> int:
    name = args.name
    target_dir = Path(args.dir).resolve() if args.dir else Path.cwd() / slugify(name)
    if target_dir.exists() and any(target_dir.iterdir()) and not args.force:
        print(f"error: {target_dir} is not empty (use --force to overwrite)", file=sys.stderr)
        return 1

    files = build_scaffold(name)
    for rel, content in files.items():
        dest = target_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")

    print(f"Created LangStitch project '{name}' at {target_dir}")
    print(f"  {len(files)} files written")
    print("\nNext steps:")
    rel_dir = target_dir.name if not args.dir else target_dir
    print(f"  cd {rel_dir}")
    print("  pip install -e .")
    print("  python -m app")
    return 0


def _bootstrap_project(root: Optional[str]):
    """Import the project's ``app`` package so decorators register."""
    base = Path(root).resolve() if root else Path.cwd()
    if str(base) not in sys.path:
        sys.path.insert(0, str(base))
    return importlib.import_module("app")


def _cmd_info(args: argparse.Namespace) -> int:
    try:
        _bootstrap_project(args.root)
    except ModuleNotFoundError:
        print("error: no 'app' package found. Run inside a LangStitch project.", file=sys.stderr)
        return 1
    from .app import LangStitchApp

    app = LangStitchApp.bootstrap(args.root)
    print(json.dumps(app.info(), indent=2))
    return 0


def _cmd_run(args: argparse.Namespace) -> int:
    try:
        _bootstrap_project(args.root)
    except ModuleNotFoundError:
        print("error: no 'app' package found. Run inside a LangStitch project.", file=sys.stderr)
        return 1
    from .registry import get_registry
    from .server import run as run_server

    spec = get_registry().server
    if spec is None:
        print("error: no @langstitch_graph_server found in this project.", file=sys.stderr)
        return 1
    run_server(spec, host=args.host, port=args.port)
    return 0


def _cmd_compile(args: argparse.Namespace) -> int:
    from .config import compile_config

    out = compile_config(args.root)
    print(f"Compiled application.yaml -> {out}")
    return 0


def _cmd_get(args: argparse.Namespace) -> int:
    from .providers import get_config

    value = get_config(args.path, root=args.root, as_json=True)
    print(value)
    return 0


def _cmd_version(_args: argparse.Namespace) -> int:
    print(f"langstitch {__version__}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="langstitch", description="LangStitch SDK CLI")
    parser.add_argument("-V", "--version", action="version", version=f"langstitch {__version__}")
    sub = parser.add_subparsers(dest="command")

    p_new = sub.add_parser("new", help="scaffold a new LangStitch project")
    p_new.add_argument("name", help="project name")
    p_new.add_argument("--dir", help="target directory (default: ./<slug>)")
    p_new.add_argument("--force", action="store_true", help="write into a non-empty directory")
    p_new.set_defaults(func=_cmd_new)

    p_info = sub.add_parser("info", help="show config + registered components")
    p_info.add_argument("--root", help="project root (default: cwd)")
    p_info.set_defaults(func=_cmd_info)

    p_run = sub.add_parser("run", help="run the API server")
    p_run.add_argument("--root", help="project root (default: cwd)")
    p_run.add_argument("--host", default=None)
    p_run.add_argument("--port", type=int, default=None)
    p_run.set_defaults(func=_cmd_run)

    p_compile = sub.add_parser(
        "compile", help="compile application.yaml -> application.json for fast startup"
    )
    p_compile.add_argument("--root", help="project root (default: cwd)")
    p_compile.set_defaults(func=_cmd_compile)

    p_get = sub.add_parser("get", help="resolve a config JSON path and print it as JSON")
    p_get.add_argument("path", help="JSON path, e.g. server.port or external_services.payments.auth.type")
    p_get.add_argument("--root", help="project root (default: cwd)")
    p_get.set_defaults(func=_cmd_get)

    p_ver = sub.add_parser("version", help="print the SDK version")
    p_ver.set_defaults(func=_cmd_version)

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 0
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
