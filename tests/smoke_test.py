from __future__ import annotations

from importlib import resources

import streamlit_schema_editor


def main() -> None:
    assert callable(streamlit_schema_editor.streamlit_schema_editor)

    build_dir = resources.files("streamlit_schema_editor") / "frontend" / "build"
    assets = list(build_dir.iterdir())
    js_assets = sorted(
        asset
        for asset in assets
        if asset.name.startswith("index-") and asset.name.endswith(".js")
    )
    css_assets = sorted(
        asset
        for asset in assets
        if asset.name.startswith("index-") and asset.name.endswith(".css")
    )

    if len(js_assets) != 1:
        raise RuntimeError(
            f"Expected exactly one frontend JS asset, found {len(js_assets)}"
        )
    if len(css_assets) != 1:
        raise RuntimeError(
            f"Expected exactly one frontend CSS asset, found {len(css_assets)}"
        )


if __name__ == "__main__":
    main()
