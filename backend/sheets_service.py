import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

SUMMARY_SHEET_NAME = "__SUMMARY__"
SUMMARY_HEADERS = [
    "trip_id",
    "trip_name",
    "start_date",
    "end_date",
    "days_count",
    "node_count",
    "last_modified_utc",
    "status",
]

TRIP_HEADERS = [
    "Day",
    "Arrival Time",
    "Departure Time",
    "Stay Duration (mins)",
    "Place Name",
    "Address",
    "Google Maps URL",
    "Notes",
    "Tags",
    "Transport To Next (mins)",
    "Transport Mode",
    "PlaceID",
    "photo_url",
]

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

DEFAULT_CREDENTIALS_PATH = (
    Path(__file__).resolve().parent / "credentials" / "gsheet_service_account.json"
)


class SheetsConfigError(RuntimeError):
    pass


def _load_gspread():
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError as exc:
        raise SheetsConfigError(
            "Google Sheets dependencies are not installed. Run pip install -r backend/requirements.txt"
        ) from exc
    return gspread, Credentials


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _credentials_path() -> Path:
    return Path(os.getenv("GSHEET_CREDENTIALS_PATH", DEFAULT_CREDENTIALS_PATH))


def _spreadsheet_id() -> str:
    spreadsheet_id = os.getenv("GSHEET_SPREADSHEET_ID", "").strip()
    if not spreadsheet_id:
        raise SheetsConfigError("GSHEET_SPREADSHEET_ID is not configured")
    return spreadsheet_id


def _worksheet_title(trip_id: str) -> str:
    return trip_id[:100]


def _require_credentials_file() -> Path:
    credentials_path = _credentials_path()
    if not credentials_path.exists():
        raise SheetsConfigError(
            f"Google Sheets credentials file not found: {credentials_path}"
        )
    return credentials_path


def get_client():
    gspread, Credentials = _load_gspread()
    credentials = Credentials.from_service_account_file(
        _require_credentials_file(),
        scopes=SCOPES,
    )
    return gspread.authorize(credentials)


def get_spreadsheet():
    return get_client().open_by_key(_spreadsheet_id())


def _get_or_create_worksheet(spreadsheet, title: str, rows: int = 100, cols: int = 20):
    gspread, _ = _load_gspread()
    try:
        return spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        return spreadsheet.add_worksheet(title=title, rows=rows, cols=cols)


def ensure_summary_sheet():
    spreadsheet = get_spreadsheet()
    worksheet = _get_or_create_worksheet(spreadsheet, SUMMARY_SHEET_NAME, rows=100, cols=8)
    values = worksheet.get_all_values()
    if not values or values[0] != SUMMARY_HEADERS:
        worksheet.update("A1:H1", [SUMMARY_HEADERS])
    return worksheet


def get_all_trips_summary() -> list[dict[str, Any]]:
    worksheet = ensure_summary_sheet()
    return worksheet.get_all_records()


def _find_summary_row(worksheet, trip_id: str) -> int | None:
    gspread, _ = _load_gspread()
    try:
        cell = worksheet.find(trip_id, in_column=1)
    except gspread.exceptions.CellNotFound:
        return None
    return cell.row if cell else None


def upsert_trip_summary(trip_id: str, meta: dict[str, Any]) -> dict[str, Any]:
    worksheet = ensure_summary_sheet()
    summary = {
        "trip_id": trip_id,
        "trip_name": meta.get("trip_name", ""),
        "start_date": meta.get("start_date", ""),
        "end_date": meta.get("end_date", ""),
        "days_count": meta.get("days_count", 0),
        "node_count": meta.get("node_count", 0),
        "last_modified_utc": meta["last_modified_utc"],
        "status": meta.get("status", "active"),
    }
    row_values = [summary[key] for key in SUMMARY_HEADERS]

    row_number = _find_summary_row(worksheet, trip_id)
    if row_number:
        worksheet.update(f"A{row_number}:H{row_number}", [row_values])
    else:
        worksheet.append_row(row_values, value_input_option="USER_ENTERED")

    return summary


def delete_trip_summary(trip_id: str) -> None:
    worksheet = ensure_summary_sheet()
    row_number = _find_summary_row(worksheet, trip_id)
    if row_number:
        worksheet.delete_rows(row_number)


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _safe_number(value: Any, fallback: int = 0) -> int:
    if value in (None, ""):
        return fallback
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def _safe_day(value: Any) -> int | None:
    try:
        day = int(value)
    except (TypeError, ValueError):
        return None
    return day if day > 0 else None


def _time_to_minutes(value: Any) -> int | None:
    if not value or not isinstance(value, str) or ":" not in value:
        return None
    hours_text, minutes_text = value.split(":", 1)
    try:
        hours = int(hours_text)
        minutes = int(minutes_text)
    except ValueError:
        return None
    if hours < 0 or minutes < 0 or minutes > 59:
        return None
    return hours * 60 + minutes


def _minutes_to_time(total_minutes: int) -> str:
    total_minutes = total_minutes % (24 * 60)
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


def _departure_time(arrival_time: str, stay_duration: int) -> str:
    arrival_minutes = _time_to_minutes(arrival_time)
    if arrival_minutes is None or stay_duration <= 0:
        return ""
    return _minutes_to_time(arrival_minutes + stay_duration)


def _maps_formula(place_id: str, place_name: str) -> str:
    if not place_id:
        return ""
    url = f"https://www.google.com/maps/search/?api=1&query_place_id={place_id}"
    label = (place_name or "Open in Maps").replace('"', '""')
    return f'=HYPERLINK("{url}", "{label}")'


def _node_place_id(node: dict[str, Any]) -> str:
    return _safe_text(node.get("selected_place_id") or node.get("place_id"))


def _node_place_name(node: dict[str, Any]) -> str:
    return _safe_text(node.get("selected_place_name") or node.get("name"))


def _is_regular_export_node(node: dict[str, Any]) -> bool:
    if node.get("node_type") in {"start", "end"}:
        return False
    if node.get("status") != "confirmed":
        return False
    return bool(_node_place_name(node))


def _tags_text(node: dict[str, Any]) -> str:
    tags = node.get("tags") or []
    if isinstance(tags, list):
        return ", ".join(str(tag) for tag in tags if tag)
    return _safe_text(tags)


def _transport_minutes(node: dict[str, Any]) -> str:
    manual = node.get("manual_transport_time")
    if manual not in (None, ""):
        return _safe_text(manual)
    value = node.get("transport_time_mins") or node.get("travel_time_mins")
    return _safe_text(value)


def _trip_rows(payload: dict[str, Any]) -> list[list[Any]]:
    rows: list[list[Any]] = []
    nodes_by_day = payload.get("nodesByDay") or {}
    for day_key in sorted(nodes_by_day, key=lambda value: _safe_day(value) or 9999):
        day = _safe_day(day_key)
        if day is None:
            continue
        nodes = nodes_by_day.get(day_key) or []
        for node in nodes:
            if not isinstance(node, dict) or not _is_regular_export_node(node):
                continue
            stay_duration = _safe_number(node.get("planned_stay_duration"), fallback=0)
            arrival_time = _safe_text(node.get("planned_arrival_time"))
            place_id = _node_place_id(node)
            place_name = _node_place_name(node)
            rows.append(
                [
                    day,
                    arrival_time,
                    _departure_time(arrival_time, stay_duration),
                    stay_duration,
                    place_name,
                    _safe_text(node.get("address")),
                    _maps_formula(place_id, place_name),
                    _safe_text(node.get("notes")),
                    _tags_text(node),
                    _transport_minutes(node),
                    _safe_text(node.get("transport_mode") or "transit"),
                    place_id,
                    _safe_text(node.get("photo_url")),
                ]
            )
    return rows


def export_trip_to_sheet(trip_id: str, trip_data: dict[str, Any]) -> dict[str, Any]:
    meta = trip_data.get("meta") or {}
    if meta.get("tripId") and meta["tripId"] != trip_id:
        raise ValueError("trip_id path parameter does not match payload meta.tripId")

    spreadsheet = get_spreadsheet()
    worksheet = _get_or_create_worksheet(
        spreadsheet,
        _worksheet_title(trip_id),
        rows=200,
        cols=len(TRIP_HEADERS),
    )

    rows = _trip_rows(trip_data)
    worksheet.clear()
    worksheet.update("A1:M1", [TRIP_HEADERS])
    if rows:
        worksheet.update(f"A2:M{len(rows) + 1}", rows, value_input_option="USER_ENTERED")
    worksheet.freeze(rows=1)

    last_modified_utc = _now_utc()
    day_configs = trip_data.get("dayConfigs") or {}
    upsert_trip_summary(
        trip_id,
        {
            "trip_name": meta.get("tripTitle", ""),
            "start_date": meta.get("startDate", ""),
            "end_date": meta.get("endDate", ""),
            "days_count": len(day_configs),
            "node_count": len(rows),
            "last_modified_utc": last_modified_utc,
            "status": "active",
        },
    )

    return {
        "success": True,
        "sheet_url": worksheet.url,
        "last_modified_utc": last_modified_utc,
    }
