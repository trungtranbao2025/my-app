# -*- coding: utf-8 -*-
# export_bao_cao_cong_viec.py
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

import os
from datetime import datetime

# --------- Cấu hình font ----------
# Nếu có file TTF (Inter/Roboto) bên cạnh script, script sẽ dùng; nếu không sẽ fallback Helvetica
def register_fonts():
    font_paths = [
        ("Inter", "Inter-Regular.ttf"),
        ("Inter-Bold", "Inter-Bold.ttf"),
        ("Roboto", "Roboto-Regular.ttf"),
        ("Roboto-Bold", "Roboto-Bold.ttf"),
    ]
    any_ok = False
    for fam, path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(fam, path))
                any_ok = True
            except Exception:
                pass
    if not any_ok:
        # dùng Helvetica mặc định
        pass

register_fonts()

FONT = "Inter" if "Inter" in pdfmetrics.getRegisteredFontNames() else (
        "Roboto" if "Roboto" in pdfmetrics.getRegisteredFontNames() else "Helvetica")
FONT_BOLD = "Inter-Bold" if "Inter-Bold" in pdfmetrics.getRegisteredFontNames() else (
        "Roboto-Bold" if "Roboto-Bold" in pdfmetrics.getRegisteredFontNames() else "Helvetica-Bold")

# --------- Màu sắc theo UI ----------
UI_COLORS = {
    "bg": colors.HexColor("#F6FAFE"),         # nền page nhạt
    "card": colors.white,
    "border": colors.HexColor("#E6EAF0"),
    "text": colors.HexColor("#1F2937"),       # xám đậm
    "muted": colors.HexColor("#6B7280"),
    "primary": colors.HexColor("#2A6EF2"),    # xanh chủ đạo
    "good": colors.HexColor("#16A34A"),
    "warn": colors.HexColor("#F59E0B"),
    "danger": colors.HexColor("#EF4444"),

    # trạng thái
    "chip_doing_bg": colors.HexColor("#FFF8DC"),
    "chip_doing_text": colors.HexColor("#8B6508"),
    "chip_overdue_bg": colors.HexColor("#FFECEC"),
    "chip_overdue_text": colors.HexColor("#B80000"),
}

# --------- Dữ liệu mẫu ----------
ROWS = [
    {
        "stt": 1,
        "khu_vuc": "Tầng 1",
        "noi_dung": "[KV: Tầng 1] Hoàn thành việc bổ sung nhân sự của Bộ theo hồ sơ yêu cầu",
        "ngay_bd": "14/10/2025",
        "han": "29/10/2025",
        "trang_thai": "ĐANG THỰC HIỆN",
        "severity": "doing",  # doing | overdue
        "pct_time": 88,
        "pct_real": 60,
        "nhan_cong": 5,
        "tang_cuong": 10
    },
    {
        "stt": 2,
        "khu_vuc": "Tầng 2",
        "noi_dung": "[KV: Tầng 2] Báo cáo tuần",
        "ngay_bd": "10/10/2025",
        "han": "16/10/2025",
        "trang_thai": "TRỄ HẠN",
        "severity": "overdue",
        "pct_time": 100,
        "pct_real": 10,
        "nhan_cong": 16,
        "tang_cuong": 208
    }
]

# --------- Tiện ích vẽ ----------
def draw_chip(c, x, y, w, h, text, severity="doing"):
    """Vẽ ô trạng thái bo tròn + thanh tiến độ mảnh bên dưới (trong cùng cell)"""
    if severity == "overdue":
        bg = UI_COLORS["chip_overdue_bg"]; fg = UI_COLORS["chip_overdue_text"]
        bar = UI_COLORS["danger"]
    else:
        bg = UI_COLORS["chip_doing_bg"]; fg = UI_COLORS["chip_doing_text"]
        bar = UI_COLORS["warn"]

    r = 3*mm
    c.setFillColor(bg); c.setStrokeColor(colors.transparent)
    c.roundRect(x, y - h, w, h, r, stroke=0, fill=1)

    # text
    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(fg)
    tw = c.stringWidth(text, FONT_BOLD, 8.5)
    c.drawString(x + (w - tw)/2.0, y - h + (h-8.5)/2.0 + 1, text)

    # progress bar (giả lập) dưới chip
    bar_y = y - h - 2.2*mm
    bar_h = 2.2*mm
    bar_w = w
    # nền
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.roundRect(x, bar_y - bar_h, bar_w, bar_h, bar_h/2, stroke=0, fill=1)
    # phần đầy
    fill_w = bar_w*0.55 if severity == "doing" else bar_w*0.35
    c.setFillColor(bar)
    c.roundRect(x, bar_y - bar_h, fill_w, bar_h, bar_h/2, stroke=0, fill=1)

def draw_action_badge(c, x, y, label="Sửa", color=colors.HexColor("#0066FF")):
    c.setStrokeColor(color); c.setFillColor(colors.white)
    c.setLineWidth(1)
    c.roundRect(x, y-6, 22, 12, 3, stroke=1, fill=1)
    c.setFont(FONT_BOLD, 7.8)
    c.setFillColor(color)
    c.drawCentredString(x+11, y-4.2, label)

def make_table_data(rows):
    # Header
    header = ["STT","KHU VỰC","NỘI DUNG CÔNG VIỆC","NGÀY BẮT ĐẦU","HẠN HOÀN THÀNH",
              "TRẠNG THÁI","% THEO\nTHỜI GIAN","% THỰC TẾ","NHÂN CÔNG","Y/C TĂNG\nCƯỜNG","THAO TÁC"]
    data = [header]
    # body (text — phần chip & nút sẽ vẽ chồng bằng canvas sau)
    for r in rows:
        data.append([
            str(r["stt"]),
            r["khu_vuc"],
            r["noi_dung"],
            r["ngay_bd"],
            r["han"],
            " ",  # placeholder chip
            f'{r["pct_time"]}%',
            f'{r["pct_real"]}%',
            str(r["nhan_cong"]),
            str(r["tang_cuong"]),
            " "  # placeholder actions
        ])
    return data

def build_pdf(filename="bao-cao-tien-do.pdf", rows=ROWS):
    # Khổ ngang cho giống bảng dài
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        leftMargin=15*mm, rightMargin=15*mm, topMargin=14*mm, bottomMargin=14*mm
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Title",
        fontName=FONT_BOLD, fontSize=16, textColor=UI_COLORS["text"],
        leading=20, spaceAfter=8))
    styles.add(ParagraphStyle(name="Muted", fontName=FONT, fontSize=9,
        textColor=UI_COLORS["muted"]))

    story = []
    story.append(Paragraph("BÁO CÁO CHI TIẾT CÔNG VIỆC", styles["Title"]))
    story.append(Paragraph(datetime.now().strftime("Ngày xuất: %d/%m/%Y · IBST BIM"), styles["Muted"]))
    story.append(Spacer(1, 6*mm))

    table_data = make_table_data(rows)

    # Kích thước cột (mm → points)
    col_widths_mm = [12, 22, 95, 28, 32, 40, 24, 24, 22, 28, 36]
    col_widths = [w*mm for w in col_widths_mm]

    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl_style = TableStyle([
        ("FONT", (0,0), (-1,0), FONT_BOLD, 9.5),
        ("TEXTCOLOR", (0,0), (-1,0), UI_COLORS["muted"]),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("FONT", (0,1), (-1,-1), FONT, 9.5),

        ("ROWBACKGROUNDS", (0,1), (-1,-1),
            [colors.white, colors.HexColor("#FAFAFA")]),
        ("GRID", (0,0), (-2,-1), 0.25, UI_COLORS["border"]),
        ("GRID", (-1,0), (-1,-1), 0.25, UI_COLORS["border"]),
        ("LINEBEFORE", (0,0), (0,-1), 0.25, UI_COLORS["border"]),
        ("LINEAFTER", (-1,0), (-1,-1), 0.25, UI_COLORS["border"]),

        ("ALIGN", (0,1), (0,-1), "CENTER"),   # STT
        ("ALIGN", (6,1), (9,-1), "CENTER"),   # các cột %
        ("TEXTCOLOR", (9,1), (9,-1), UI_COLORS["danger"]),  # Y/C tăng cường đỏ
    ])
    tbl.setStyle(tbl_style)
    story.append(tbl)
    doc.build(story, onFirstPage=lambda c, d: decorate_page(c, d, rows, col_widths),
                     onLaterPages=lambda c, d: decorate_page(c, d, rows, col_widths))

def decorate_page(c, doc, rows, col_widths):
    """
    Vẽ phần “chip trạng thái” & “nút Sửa/Xóa” đè lên các ô tương ứng để đạt hiệu ứng UI.
    Hàm này chạy sau khi Table được vẽ.
    """
    # Tính toạ độ bảng theo SimpleDocTemplate flowables đã vẽ
    # Bảng có top-left ở (doc.leftMargin, doc.height + doc.bottomMargin - offset)
    # Nhưng để đơn giản và ổn định: ta suy ra từ kích thước cột & chiều cao dòng
    # ReportLab không expose dễ dàng vị trí từng ô; ta sẽ ước lượng dựa vào layout hiện tại.

    # Vị trí x bắt đầu của bảng
    x0 = doc.leftMargin
    # Vị trí y đỉnh của bảng: từ mép trên nội dung (doc.height + topMargin)
    # Ở đây ta ước lượng theo tiêu đề + spacer (~ 16pt + 12pt + 6mm)
    # Để an toàn, vẽ “chip” tương đối theo số dòng: cao dòng ~ 18pt
    row_height = 18  # điểm (pt)
    header_h = row_height
    body_y_top = doc.height + doc.topMargin - (16 + 12 + 6*mm) - header_h  # sau header + spacer + header row
    # Cột “Trạng thái” là index 5
    col_x = [x0]
    for w in col_widths:
        col_x.append(col_x[-1] + w)

    col_status_l = col_x[5]
    col_status_r = col_x[6]
    col_action_l = col_x[10]
    col_action_r = col_x[11]

    # Vẽ từng dòng body
    for i, r in enumerate(rows, start=1):
        # y của đỉnh ô (dòng i, sau header)
        y_top = body_y_top - (i-1)*row_height

        # Chip trạng thái (cao 10mm, rộng ~ cột)
        chip_w = (col_status_r - col_status_l) - 4
        chip_h = 10  # pt
        chip_x = col_status_l + 2
        chip_y = y_top - 4  # trễ nhẹ xuống cho cân
        draw_chip(c, chip_x, chip_y, chip_w, chip_h, r["trang_thai"], r["severity"])

        # Nút Sửa / Xóa trong cột Thao tác
        btn_y = y_top - 5
        left = col_action_l + 4
        draw_action_badge(c, left, btn_y, "Sửa", colors.HexColor("#0066FF"))
        draw_action_badge(c, left + 28, btn_y, "Xóa", colors.HexColor("#FF3B3B"))

def main():
    build_pdf("bao-cao-tien-do.pdf", ROWS)
    print("Đã xuất: bao-cao-tien-do.pdf")

if __name__ == "__main__":
    main()
