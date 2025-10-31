from __future__ import annotations

from app.models import ProgressInput, MaterialItem
from app.services import compute_progress


def test_basic_kpis_happy_path():
    inp = ProgressInput(
        PV=100,
        EV=80,
        AC=90,
        T=10,
        E=5,
        p_recent=10,
        remain_days=5,
        safety_incidents=0,
        materials=[MaterialItem(name="Cement", planned_qty=100, actual_qty=100)],
    )
    out = compute_progress(inp)
    # CPI ~ 0.8889, SPI = 0.8
    assert any(k.name == "CPI" and 0.88 <= k.value <= 0.89 for k in out.kpis)
    assert any(k.name == "SPI" and k.value == 0.8 for k in out.kpis)
    # Schedule = E/T * 100 = 50
    assert any(k.name == "Schedule" and k.value == 50.0 for k in out.kpis)
    # Forecast uses p_recent since remain_days>0: clamp to 100
    assert any(k.name == "Forecast" and k.value == 100.0 for k in out.kpis)
    # Materials 100, Safety 100
    assert any(k.name == "Materials" and k.value == 100.0 for k in out.kpis)
    assert any(k.name == "Safety" and k.value == 100.0 for k in out.kpis)
    assert out.email_message_vi and "Báo cáo nhanh tiến độ" in out.email_message_vi


def test_zero_divisions_and_defaults():
    inp = ProgressInput(
        PV=0,
        EV=0,
        AC=0,
        T=0,
        E=0,
        p_recent=0,
        remain_days=0,
        safety_incidents=0,
        materials=[],
    )
    out = compute_progress(inp)
    # CPI and SPI should be 0, schedule 0, forecast 0
    assert any(k.name == "CPI" and k.value == 0 for k in out.kpis)
    assert any(k.name == "SPI" and k.value == 0 for k in out.kpis)
    assert any(k.name == "Schedule" and k.value == 0 for k in out.kpis)
    assert any(k.name == "Forecast" and k.value == 0 for k in out.kpis)


def test_materials_penalty():
    inp = ProgressInput(
        PV=50,
        EV=25,
        AC=40,
        T=20,
        E=10,
        p_recent=0,
        remain_days=0,
        safety_incidents=0,
        materials=[MaterialItem(name="Steel", planned_qty=100, actual_qty=50)],
    )
    out = compute_progress(inp)
    # Materials ~ 50%
    assert any(k.name == "Materials" and 49.9 <= k.value <= 50.1 for k in out.kpis)


def test_safety_penalty():
    inp = ProgressInput(
        PV=50,
        EV=25,
        AC=40,
        T=20,
        E=10,
        p_recent=0,
        remain_days=0,
        safety_incidents=3,
        materials=[],
    )
    out = compute_progress(inp)
    # Safety = 100 - 3*5 = 85
    assert any(k.name == "Safety" and 84.9 <= k.value <= 85.1 for k in out.kpis)


def test_remain_days_zero_uses_current_ratio():
    inp = ProgressInput(
        PV=50,
        EV=25,
        AC=25,
        T=10,
        E=5,
        p_recent=0,  # ignored because remain_days==0
        remain_days=0,
        safety_incidents=0,
        materials=[],
    )
    out = compute_progress(inp)
    # Forecast = (EV / PV) * 100 = 50%
    assert any(k.name == "Forecast" and 49.9 <= k.value <= 50.1 for k in out.kpis)
