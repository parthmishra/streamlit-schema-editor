from __future__ import annotations

from pathlib import Path
from typing import Any

import streamlit as st
from streamlit.errors import StreamlitAPIException

_COMPONENT: Any | None = None
_COMPONENT_NAME = "streamlit-schema-editor.streamlit_schema_editor"


def _load_built_asset(pattern: str) -> str:
    build_dir = Path(__file__).resolve().parent / "frontend" / "build"
    matches = sorted(build_dir.glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one built asset matching '{pattern}' in '{build_dir}', found {len(matches)}."
        )
    content = matches[0].read_text(encoding="utf-8")
    # CCv2 treats path-like single-line strings as file references. Add an internal
    # newline so this is always interpreted as inline JS/CSS during fallback.
    return f"{content}\n/* streamlit-schema-editor-inline */"


def get_component() -> Any:
    global _COMPONENT
    if _COMPONENT is None:
        try:
            _COMPONENT = st.components.v2.component(
                _COMPONENT_NAME,
                html='<div class="react-root"></div>',
                js="index-*.js",
                css="index-*.css",
            )
        except StreamlitAPIException as exc:
            # Local source runs may not have manifest discovery active.
            if "must be declared in pyproject.toml with asset_dir" not in str(exc):
                raise

            _COMPONENT = st.components.v2.component(
                _COMPONENT_NAME,
                html='<div class="react-root"></div>',
                js=_load_built_asset("index-*.js"),
                css=_load_built_asset("index-*.css"),
            )
    return _COMPONENT


__all__ = ["get_component"]
