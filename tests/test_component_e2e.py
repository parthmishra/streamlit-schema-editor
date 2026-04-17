from __future__ import annotations

import socket
import subprocess
import time
from pathlib import Path

import pytest
import requests
from playwright.sync_api import Error, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "tests" / "fixtures" / "e2e_app.py"
EDGE_ID = "rel::crm_customer::customer_name::dim_customer::customer_name"


def _find_open_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_app(url: str, process: subprocess.Popen[str], timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process.poll() is not None:
            stdout = process.stdout.read() if process.stdout else ""
            stderr = process.stderr.read() if process.stderr else ""
            raise RuntimeError(f"Streamlit exited early.\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}")
        try:
            response = requests.get(url, timeout=1)
            if response.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(0.5)
    raise TimeoutError(f"Timed out waiting for Streamlit app at {url}")


@pytest.fixture()
def streamlit_app() -> str:
    port = _find_open_port()
    url = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [
            "uv",
            "run",
            "streamlit",
            "run",
            str(APP_PATH),
            "--server.headless",
            "true",
            "--server.port",
            str(port),
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        _wait_for_app(url, process)
        yield url
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def test_edge_button_round_trip(streamlit_app: str) -> None:
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            page.goto(streamlit_app, wait_until="networkidle")

            expect_title = page.get_by_text("E2E Schema Editor")
            expect_title.wait_for()

            edge_button = page.get_by_label(
                "Inspect relationship from crm_customer.customer_name to dim_customer.customer_name"
            )
            edge_button.click()

            page.get_by_text("event::edge_details_requested").wait_for()
            page.get_by_text(f"selected_relationship::{EDGE_ID}").wait_for()
            page.get_by_text(f"context_relationship::{EDGE_ID}").wait_for()

            browser.close()
    except Error as exc:
        pytest.skip(f"Playwright browser is unavailable: {exc}")


def test_inline_column_editing_round_trip(streamlit_app: str) -> None:
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            page.goto(streamlit_app, wait_until="networkidle")

            page.get_by_text("E2E Schema Editor").wait_for()

            page.get_by_label("Add column to table crm_customer").click()
            page.get_by_text("event::column_created").wait_for()
            page.get_by_text("context_table::crm_customer").wait_for()
            page.get_by_text("context_column::crm_customer__new_column").wait_for()
            page.get_by_text(
                "crm_customer_columns::customer_id,customer_name,new_column"
            ).wait_for()

            page.get_by_label(
                "Edit column name for new_column in table crm_customer"
            ).click()
            page.get_by_label(
                "Edit column name for new_column in table crm_customer"
            ).fill("customer_alias")
            page.get_by_label(
                "Edit column name for new_column in table crm_customer"
            ).press("Enter")
            page.get_by_text("event::column_updated").wait_for()
            page.get_by_text(
                "crm_customer_columns::customer_id,customer_name,customer_alias"
            ).wait_for()

            page.get_by_label(
                "Edit column data type for customer_alias in table crm_customer"
            ).click()
            page.get_by_role("listbox", name="Suggested data types").wait_for()
            page.mouse.click(24, 24)
            page.get_by_role(
                "listbox", name="Suggested data types"
            ).wait_for(state="detached")

            page.get_by_label(
                "Edit column data type for customer_alias in table crm_customer"
            ).click()
            page.get_by_label(
                "Edit column data type for customer_alias in table crm_customer"
            ).fill("js")
            page.get_by_role("option", name="json").click()
            page.get_by_text("crm_customer_types::uuid,varchar,json").wait_for()

            page.get_by_label(
                "Delete column customer_alias from table crm_customer"
            ).click()
            page.get_by_text("event::column_deleted").wait_for()
            page.get_by_text(
                "crm_customer_columns::customer_id,customer_name"
            ).wait_for()

            browser.close()
    except Error as exc:
        pytest.skip(f"Playwright browser is unavailable: {exc}")
