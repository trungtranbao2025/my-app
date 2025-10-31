from __future__ import annotations
from typing import List

from .models import ProgressInput, ProgressOutput, KPI, Recommendation


def clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def safe_div(n: float, d: float) -> float:
    if d == 0:
        return 0.0
    return n / d


def compute_progress(inp: ProgressInput) -> ProgressOutput:
    # Cost Performance Index (CPI) and Schedule Performance Index (SPI)
    cpi = safe_div(inp.EV, inp.AC)
    spi = safe_div(inp.EV, inp.PV)

    # Overall Performance (weighted example)
    overall = clamp((cpi * 50 + spi * 50), 0, 100)

    # Schedule adherence: planned vs elapsed time
    schedule = 0.0
    if inp.T > 0:
        schedule = clamp(safe_div(inp.E, inp.T) * 100)

    # Forecast remaining using recent performance p_recent
    # When remain_days = 0, keep forecast = current EV/PV ratio
    progress_rate = inp.p_recent if inp.remain_days > 0 else safe_div(inp.EV, max(inp.PV, 1.0))
    forecast = clamp(safe_div(inp.EV + progress_rate * inp.remain_days, max(inp.PV, 1.0)) * 100)

    # Materials sufficiency: average actual/planned across provided items
    mat_scores: List[float] = []
    for m in inp.materials:
        mat_scores.append(safe_div(m.actual_qty, max(m.planned_qty, 1e-9)))
    materials_ok = 100.0 if not mat_scores else clamp(sum(mat_scores) / len(mat_scores) * 100)

    # Safety impact: simple penalty for incidents
    safety_score = clamp(100.0 - inp.safety_incidents * 5.0)

    kpis = [
        KPI(name="CPI", value=round(cpi, 3), unit="", label_vi="Chỉ số hiệu quả chi phí (CPI)"),
        KPI(name="SPI", value=round(spi, 3), unit="", label_vi="Chỉ số hiệu quả tiến độ (SPI)"),
        KPI(name="Schedule", value=round(schedule, 1), label_vi="Tuân thủ tiến độ"),
        KPI(name="Forecast", value=round(forecast, 1), label_vi="Dự báo hoàn thành"),
        KPI(name="Materials", value=round(materials_ok, 1), label_vi="Đảm bảo vật tư"),
        KPI(name="Safety", value=round(safety_score, 1), label_vi="An toàn lao động"),
        KPI(name="Overall", value=round(overall, 1), label_vi="Tổng hợp"),
    ]

    recs: List[Recommendation] = []

    # Recommendations based on thresholds
    cost_items: List[str] = []
    if cpi < 0.95:
        cost_items.append("Kiểm soát chi phí, rà soát các hạng mục vượt dự toán.")
    if spi < 0.95:
        cost_items.append("Tăng cường nhân lực/ca làm để kéo lại tiến độ.")
    if cost_items:
        recs.append(Recommendation(category="Chi phí & Tiến độ", items=cost_items))

    mat_items: List[str] = []
    if materials_ok < 90:
        mat_items.append("Đảm bảo nguồn vật tư dự phòng, cập nhật kế hoạch cung ứng.")
    if mat_items:
        recs.append(Recommendation(category="Vật tư", items=mat_items))

    safety_items: List[str] = []
    if safety_score < 95:
        safety_items.append("Tăng cường kiểm tra an toàn, tổ chức nhắc nhở hiện trường.")
    if safety_items:
        recs.append(Recommendation(category="An toàn", items=safety_items))

    email_lines: List[str] = [
        "Kính gửi Ban Quản lý Dự án,",
        "",
        "Báo cáo nhanh tiến độ dự án:",
        f"- CPI: {round(cpi,3)} | SPI: {round(spi,3)}",
        f"- Tuân thủ tiến độ: {round(schedule,1)}% | Dự báo hoàn thành: {round(forecast,1)}%",
        f"- Vật tư: {round(materials_ok,1)}% | An toàn: {round(safety_score,1)}%",
        f"- Tổng hợp Overall: {round(overall,1)}%",
        "",
        "Đề xuất hành động ưu tiên:",
    ]
    if not recs:
        email_lines.append("- Tiếp tục duy trì nhịp độ hiện tại.")
    else:
        for r in recs:
            for it in r.items:
                email_lines.append(f"- {it}")
    email_lines.append("")
    email_lines.append("Trân trọng.")

    return ProgressOutput(kpis=kpis, recommendations=recs, email_message_vi="\n".join(email_lines))
