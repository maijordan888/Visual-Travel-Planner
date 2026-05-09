import os
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

SUMMARY_SHEET_NAME = "__SUMMARY__"
METADATA_SHEET_NAME = "__TRIP_METADATA__"
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

METADATA_HEADERS = [
    "trip_id",
    "trip_json",
    "last_modified_utc",
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
    BACKEND_DIR / "credentials" / "gsheet_service_account.json"
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


def ensure_metadata_sheet():
    spreadsheet = get_spreadsheet()
    worksheet = _get_or_create_worksheet(
        spreadsheet,
        METADATA_SHEET_NAME,
        rows=100,
        cols=len(METADATA_HEADERS),
    )
    values = worksheet.get_all_values()
    if not values or values[0] != METADATA_HEADERS:
        worksheet.update("A1:C1", [METADATA_HEADERS])
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


def upsert_trip_metadata(
    trip_id: str,
    trip_data: dict[str, Any],
    last_modified_utc: str,
) -> None:
    worksheet = ensure_metadata_sheet()
    meta = trip_data.get("meta") or {}
    metadata = {
        "meta": {
            "tripId": trip_id,
            "tripTitle": meta.get("tripTitle", ""),
            "startDate": meta.get("startDate", ""),
            "endDate": meta.get("endDate", ""),
            "localLastModifiedUtc": meta.get("localLastModifiedUtc"),
            "sheetLastModifiedUtc": last_modified_utc,
        },
        "dayConfigs": trip_data.get("dayConfigs") or {},
    }
    row_values = [
        trip_id,
        json.dumps(metadata, ensure_ascii=False, separators=(",", ":")),
        last_modified_utc,
    ]
    row_number = _find_summary_row(worksheet, trip_id)
    if row_number:
        worksheet.update(f"A{row_number}:C{row_number}", [row_values])
    else:
        worksheet.append_row(row_values, value_input_option="RAW")


def get_trip_metadata(trip_id: str) -> dict[str, Any]:
    worksheet = ensure_metadata_sheet()
    row_number = _find_summary_row(worksheet, trip_id)
    if not row_number:
        return {}
    values = worksheet.row_values(row_number)
    if len(values) < 2 or not values[1]:
        return {}
    try:
        metadata = json.loads(values[1])
    except json.JSONDecodeError:
        return {}
    if len(values) >= 3 and values[2]:
        metadata.setdefault("meta", {})["sheetLastModifiedUtc"] = values[2]
    return metadata


def delete_trip_metadata(trip_id: str) -> None:
    worksheet = ensure_metadata_sheet()
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


def _valid_time(value: Any) -> bool:
    if value in (None, ""):
        return True
    if not isinstance(value, str) or not re.match(r"^\d{1,2}:\d{2}$", value):
        return False
    return _time_to_minutes(value) is not None


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


def _tags_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(tag).strip() for tag in value if str(tag).strip()]
    if not value:
        return []
    return [tag.strip() for tag in str(value).split(",") if tag.strip()]


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
    upsert_trip_metadata(trip_id, trip_data, last_modified_utc)

    return {
        "success": True,
        "sheet_url": worksheet.url,
        "last_modified_utc": last_modified_utc,
    }


def _summary_for_trip(trip_id: str) -> dict[str, Any]:
    for trip in get_all_trips_summary():
        if trip.get("trip_id") == trip_id:
            return trip
    return {}


def _default_day_config() -> dict[str, Any]:
    return {
        "startLocation": "",
        "endLocation": "",
        "startTime": "09:00",
        "maxReturnTime": "22:00",
        "autoUpdate": True,
    }


def _ensure_day_configs(
    day_configs: dict[str, Any],
    rows_by_day: dict[str, list[dict[str, Any]]],
    summary: dict[str, Any],
) -> dict[str, Any]:
    normalized = {str(day): config for day, config in (day_configs or {}).items()}
    day_count = _safe_number(summary.get("days_count"), fallback=0)
    row_days = [_safe_day(day) for day in rows_by_day.keys()]
    max_row_day = max([day for day in row_days if day], default=0)
    total_days = max(day_count, max_row_day, len(normalized), 1)
    for day in range(1, total_days + 1):
        normalized.setdefault(str(day), _default_day_config())
    return normalized


def _worksheet_rows(worksheet) -> list[dict[str, Any]]:
    values = worksheet.get_all_values()
    if not values:
        return []
    headers = values[0]
    rows = []
    for row_index, row_values in enumerate(values[1:], start=2):
        row = {
            header: row_values[index] if index < len(row_values) else ""
            for index, header in enumerate(headers)
        }
        row["_row_number"] = row_index
        rows.append(row)
    return rows


def _validation_issue(
    row: int | None,
    field: str,
    issue: str,
    severity: str = "warning",
    original_value: str | None = None,
    corrected_value: str | None = None,
    auto_fixed: bool = False,
) -> dict[str, Any]:
    return {
        "row": row,
        "field": field,
        "issue": issue,
        "severity": severity,
        "auto_fixed": auto_fixed,
        "original_value": original_value,
        "corrected_value": corrected_value,
    }


def _node_from_sheet_row(row: dict[str, Any], issues: list[dict[str, Any]]) -> tuple[int | None, dict[str, Any] | None]:
    row_number = row.get("_row_number")
    day = _safe_day(row.get("Day"))
    if day is None:
        issues.append(
            _validation_issue(
                row_number,
                "Day",
                "Day must be a positive number; row skipped.",
                severity="error",
                original_value=_safe_text(row.get("Day")),
            )
        )
        return None, None

    place_name = _safe_text(row.get("Place Name")).strip()
    if not place_name:
        issues.append(
            _validation_issue(
                row_number,
                "Place Name",
                "Place name is required; row skipped.",
                severity="error",
            )
        )
        return day, None

    arrival_time = _safe_text(row.get("Arrival Time")).strip()
    departure_time = _safe_text(row.get("Departure Time")).strip()
    if not _valid_time(arrival_time):
        issues.append(
            _validation_issue(
                row_number,
                "Arrival Time",
                "Arrival time must use HH:MM format; imported as blank.",
                original_value=arrival_time,
                corrected_value="",
                auto_fixed=True,
            )
        )
        arrival_time = ""
    if departure_time and not _valid_time(departure_time):
        issues.append(
            _validation_issue(
                row_number,
                "Departure Time",
                "Departure time must use HH:MM format.",
                original_value=departure_time,
            )
        )
    if arrival_time and departure_time:
        arrival_minutes = _time_to_minutes(arrival_time)
        departure_minutes = _time_to_minutes(departure_time)
        if (
            arrival_minutes is not None
            and departure_minutes is not None
            and departure_minutes < arrival_minutes
        ):
            issues.append(
                _validation_issue(
                    row_number,
                    "Departure Time",
                    "Departure time is earlier than arrival time.",
                    original_value=departure_time,
                )
            )

    place_id = _safe_text(row.get("PlaceID")).strip() or None
    if not place_id:
        issues.append(
            _validation_issue(
                row_number,
                "PlaceID",
                "PlaceID is empty; v1 import keeps the place name and does not re-geocode automatically.",
                original_value="",
            )
        )

    stay_duration = _safe_number(row.get("Stay Duration (mins)"), fallback=60)
    node = {
        "id": f"sheet_{day}_{row_number}",
        "status": "confirmed",
        "selected_place_id": place_id,
        "selected_place_name": place_name,
        "rating": 0,
        "address": _safe_text(row.get("Address")),
        "lat": None,
        "lng": None,
        "photo_url": _safe_text(row.get("photo_url")) or None,
        "types": [],
        "tags": _tags_list(row.get("Tags")),
        "notes": _safe_text(row.get("Notes")),
        "planned_arrival_time": arrival_time,
        "planned_stay_duration": stay_duration,
        "transport_mode": _safe_text(row.get("Transport Mode") or "transit"),
        "manual_transport_time": _safe_number(
            row.get("Transport To Next (mins)"),
            fallback=0,
        ) or None,
        "options": [],
    }
    return day, node


def import_trip_from_sheet(trip_id: str) -> dict[str, Any]:
    gspread, _ = _load_gspread()
    spreadsheet = get_spreadsheet()
    try:
        worksheet = spreadsheet.worksheet(_worksheet_title(trip_id))
    except gspread.WorksheetNotFound as exc:
        raise FileNotFoundError(f"Trip sheet not found: {trip_id}") from exc

    summary = _summary_for_trip(trip_id)
    metadata = get_trip_metadata(trip_id)
    meta = metadata.get("meta") or {}
    validation_errors: list[dict[str, Any]] = []
    nodes_by_day: dict[str, list[dict[str, Any]]] = {}

    for row in _worksheet_rows(worksheet):
        day, node = _node_from_sheet_row(row, validation_errors)
        if day is None or node is None:
            continue
        nodes_by_day.setdefault(str(day), []).append(node)

    last_modified_utc = (
        meta.get("sheetLastModifiedUtc")
        or summary.get("last_modified_utc")
        or _now_utc()
    )
    start_date = meta.get("startDate") or summary.get("start_date") or ""
    end_date = meta.get("endDate") or summary.get("end_date") or start_date
    trip_data = {
        "meta": {
            "tripId": trip_id,
            "tripTitle": meta.get("tripTitle") or summary.get("trip_name") or "",
            "startDate": start_date,
            "endDate": end_date,
            "localLastModifiedUtc": meta.get("localLastModifiedUtc"),
            "sheetLastModifiedUtc": last_modified_utc,
        },
        "dayConfigs": _ensure_day_configs(
            metadata.get("dayConfigs") or {},
            nodes_by_day,
            summary,
        ),
        "nodesByDay": nodes_by_day,
    }
    return {
        "trip_data": trip_data,
        "validation_errors": validation_errors,
    }


def delete_trip_sheet(trip_id: str) -> None:
    gspread, _ = _load_gspread()
    spreadsheet = get_spreadsheet()
    try:
        worksheet = spreadsheet.worksheet(_worksheet_title(trip_id))
    except gspread.WorksheetNotFound:
        worksheet = None
    if worksheet:
        spreadsheet.del_worksheet(worksheet)
    delete_trip_summary(trip_id)
    delete_trip_metadata(trip_id)
