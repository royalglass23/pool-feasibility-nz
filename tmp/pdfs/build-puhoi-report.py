from pathlib import Path
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "135-fiddlers-hill-road-puhoi-manual-review-2026-08-05.pdf"
IMG_3D_SOURCE = ROOT / "output" / "pdf" / "assets" / "135-fiddlers-3d-aerial.png"
IMG_TOP_SOURCE = ROOT / "output" / "pdf" / "assets" / "135-fiddlers-top-down-aerial.png"
IMG_3D = ROOT / "tmp" / "pdfs" / "135-fiddlers-3d-report.jpg"
IMG_TOP = ROOT / "tmp" / "pdfs" / "135-fiddlers-top-report.jpg"

PAGE_W, PAGE_H = A4
M = 42
INK = HexColor("#172229")
MUTED = HexColor("#53636B")
TEAL = HexColor("#0B7469")
TEAL_DARK = HexColor("#123D39")
TEAL_PALE = HexColor("#E8F4F1")
AMBER = HexColor("#B75916")
AMBER_PALE = HexColor("#FFF3E6")
LINE = HexColor("#D7E0E2")
PANEL = HexColor("#F4F7F7")
BLUE = HexColor("#0B87A5")


def wrap(text, font, size, width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if stringWidth(trial, font, size) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(c, text, x, y, width, size=9.4, leading=13, color=MUTED,
              font="Helvetica", max_lines=None):
    lines = wrap(text, font, size, width)
    if max_lines:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def heading(c, text, x, y, size=18):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x, y, text)


def rounded_panel(c, x, y, w, h, fill=PANEL, stroke=LINE, radius=9):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def image_cover(c, path, x, y, w, h):
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, 8)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2,
                width=dw, height=dh, mask="auto")
    c.restoreState()
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, h, 8, fill=0, stroke=1)


def header(c, page, section):
    c.setFillColor(TEAL_DARK)
    c.rect(0, PAGE_H - 52, PAGE_W, 52, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M, PAGE_H - 31, "ROYAL GLASS - PRELIMINARY PROPERTY REVIEW")
    c.setFont("Helvetica", 8.5)
    c.drawRightString(PAGE_W - M, PAGE_H - 31, f"{section}  |  {page} of 3")


def footer(c, page):
    c.setStrokeColor(LINE)
    c.line(M, 30, PAGE_W - M, 30)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(M, 17, "Manual desktop review - generated 5 August 2026 - not a survey or approval")
    c.drawRightString(PAGE_W - M, 17, f"PFA-MANUAL-20260805-1517831  |  {page}/3")


def fact(c, x, y, w, label, value):
    rounded_panel(c, x, y, w, 48, white, LINE, 7)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 10, y + 31, label.upper())
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(x + 10, y + 14, value)


def status_row(c, y, label, status, note, status_color):
    c.setStrokeColor(LINE)
    c.line(M, y - 8, PAGE_W - M, y - 8)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(M, y + 8, label)
    c.setFillColor(status_color)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(M + 132, y + 8, status)
    paragraph(c, note, M + 215, y + 8, PAGE_W - M - (M + 215), size=8.3, leading=10.5, color=MUTED)


def page_one(c):
    header(c, 1, "MANUAL SUMMARY")
    heading(c, "135 Fiddlers Hill Road", M, PAGE_H - 92, 25)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 12)
    c.drawString(M, PAGE_H - 112, "Puhoi 0994 - Auckland")

    rounded_panel(c, M, PAGE_H - 190, PAGE_W - 2*M, 56, AMBER_PALE, HexColor("#F2C49C"), 9)
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 14, PAGE_H - 157, "OVERALL STATUS")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(M + 112, PAGE_H - 160, "NEEDS CHECKING")
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    c.drawString(M + 14, PAGE_H - 177, "Potential exists, but terrain, drainage, title and construction access are not cleared by the desktop result.")

    image_cover(c, IMG_3D, M, PAGE_H - 440, PAGE_W - 2*M, 225)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.8)
    c.drawString(M, PAGE_H - 452, "Oblique LINZ aerial draped over terrain. White = parcel; blue = illustrative pool; red = matched address point.")

    heading(c, "Manual conclusion", M, PAGE_H - 486, 15)
    y = paragraph(c,
        "The address and parcel match successfully. The 3.57 hectare title contains broad open areas, and the system can geometrically fit a large pool shell. However, that fit is plan-view only. The real aerial shows a rural hillside property with vegetation, formed access and existing buildings. A buildable pool location cannot be confirmed until slope, earthworks, drainage, wastewater, legal interests and vehicle access are checked onsite.",
        M, PAGE_H - 505, PAGE_W - 2*M, size=9.4, leading=13)

    gap = 8
    fw = (PAGE_W - 2*M - 2*gap) / 3
    fy = y - 59
    fact(c, M, fy, fw, "Parcel", "Lot 2 DP 489596")
    fact(c, M + fw + gap, fy, fw, "Title area", "35,693 m2 (3.57 ha)")
    fact(c, M + 2*(fw + gap), fy, fw, "Record of title", "704732")
    footer(c, 1)


def page_two(c):
    header(c, 2, "AERIAL AND SYSTEM EVIDENCE")
    heading(c, "What the property data actually shows", M, PAGE_H - 90, 22)
    paragraph(c,
        "The top-down view is the reference for boundary context and approximate placement. The 3D view is for terrain context only and must not be used for measurement.",
        M, PAGE_H - 110, PAGE_W - 2*M, size=9.2, leading=12)
    image_cover(c, IMG_TOP, M, PAGE_H - 390, PAGE_W - 2*M, 250)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.8)
    c.drawString(M, PAGE_H - 402, "Illustrative pool footprint only - not surveyed, engineered or approved. Placement may be invalid after site checks.")

    heading(c, "System result, translated", M, PAGE_H - 438, 15)
    status_row(c, PAGE_H - 474, "Address and parcel", "VERIFIED", "Exact LINZ address match; selected point falls within Lot 2 DP 489596.", TEAL)
    status_row(c, PAGE_H - 518, "Geometric space", "INDICATED", "Engine returned about 35,164 m2 of plan-view candidate area and fitted a 9 x 4 m shell. This is not level or constructible area.", TEAL)
    status_row(c, PAGE_H - 568, "Terrain and slope", "NEEDS CHECKING", "No engineering-grade slope result was available. The 3D aerial shows meaningful relief around the site.", AMBER)
    status_row(c, PAGE_H - 612, "Flooding and drainage", "NEEDS CHECKING", "The saved assessment flagged an apparent overland flow-path conflict; specialist confirmation is required.", AMBER)
    status_row(c, PAGE_H - 656, "Construction access", "NEEDS CHECKING", "A formed driveway is visible, but truck, crane and excavation access were not assessed.", AMBER)
    status_row(c, PAGE_H - 700, "Utilities and services", "PARTIAL", "Public mapped services did not block the screen; private water, wastewater, drainage and power still require locating.", BLUE)

    rounded_panel(c, M, 50, PAGE_W - 2*M, 55, TEAL_PALE, HexColor("#B5DCD5"), 8)
    c.setFillColor(TEAL_DARK)
    c.setFont("Helvetica-Bold", 9.2)
    c.drawString(M + 12, 85, "Why the old score was misleading")
    paragraph(c,
        "The prior '100' score mostly reflected geometry and available mapped constraints. It did not mean the property was cleared for construction, because slope, drainage and access remained unknown.",
        M + 12, 69, PAGE_W - 2*M - 24, size=8.5, leading=10.5, color=TEAL_DARK)
    footer(c, 2)


def check_item(c, number, title, detail, x, y, w):
    c.setFillColor(TEAL)
    c.circle(x + 12, y + 4, 11, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + 12, y + 1, str(number))
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(x + 32, y + 9, title)
    paragraph(c, detail, x + 32, y - 5, w - 32, size=8.3, leading=10.5, color=MUTED)


def page_three(c):
    header(c, 3, "NEXT CHECKS AND SOURCES")
    heading(c, "What to do before pricing a pool", M, PAGE_H - 90, 22)
    paragraph(c,
        "Use the report as an address-screening brief. Do not treat the blue footprint as the chosen pool position.",
        M, PAGE_H - 111, PAGE_W - 2*M, size=9.3, leading=12)

    rounded_panel(c, M, PAGE_H - 410, PAGE_W - 2*M, 260, white, LINE, 9)
    col_w = (PAGE_W - 2*M - 38) / 2
    check_item(c, 1, "Confirm title constraints", "Review title 704732, easements, covenants, consent notices and legal access.", M + 14, PAGE_H - 190, col_w)
    check_item(c, 2, "Survey the candidate zone", "Record levels, boundaries, buildings, retaining and required setbacks.", M + 14, PAGE_H - 262, col_w)
    check_item(c, 3, "Check ground conditions", "Geotechnical review for cut/fill, retaining, bearing, stability and groundwater.", M + 14, PAGE_H - 334, col_w)
    check_item(c, 4, "Verify drainage", "Confirm the apparent flow-path flag and plan stormwater without worsening runoff.", M + 24 + col_w, PAGE_H - 190, col_w)
    check_item(c, 5, "Locate all services", "Obtain BeforeUdig plans and locate private wastewater, water, power and drainage onsite.", M + 24 + col_w, PAGE_H - 262, col_w)
    check_item(c, 6, "Prove construction access", "Check excavator, spoil removal, concrete delivery and crane routes before quotation.", M + 24 + col_w, PAGE_H - 334, col_w)

    heading(c, "Recommended next decision", M, PAGE_H - 448, 15)
    rounded_panel(c, M, PAGE_H - 530, PAGE_W - 2*M, 62, TEAL_PALE, HexColor("#B5DCD5"), 8)
    c.setFillColor(TEAL_DARK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(M + 14, PAGE_H - 492, "Proceed to a site visit and levels check - not directly to quotation.")
    paragraph(c,
        "A site visit should identify one or two genuinely level or economically terraceable zones, then the pool footprint can be repositioned without hiding conflicts.",
        M + 14, PAGE_H - 509, PAGE_W - 2*M - 28, size=8.6, leading=11, color=TEAL_DARK)

    heading(c, "Sources used", M, PAGE_H - 568, 14)
    sources = [
        "LINZ NZ Addresses - address ID 1517831 - exact matched address and point geometry.",
        "LINZ NZ Primary Parcels - parcel ID 7625496 - Lot 2 DP 489596 and parcel geometry.",
        "Toitu Te Whenua LINZ Basemaps - aerial imagery and terrain tiles - CC BY 4.0.",
        "Saved system assessment - plan-view candidate fit, mapped-service screen and flow-path warning.",
    ]
    sy = PAGE_H - 590
    for source in sources:
        c.setFillColor(TEAL)
        c.circle(M + 3, sy + 3, 2.3, fill=1, stroke=0)
        paragraph(c, source, M + 12, sy + 6, PAGE_W - 2*M - 12, size=8.2, leading=10.5, color=MUTED)
        sy -= 14

    rounded_panel(c, M, 52, PAGE_W - 2*M, 92, AMBER_PALE, HexColor("#F2C49C"), 8)
    c.setFillColor(AMBER)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(M + 12, 127, "LIMITATIONS")
    paragraph(c,
        "This is a preliminary desktop review, not approval, consent advice, engineering design, a survey, title advice, utility location or an approved pool position. Aerial imagery can be dated or distorted. The 3D perspective is contextual and the illustrated pool has not been checked for setbacks, earthworks, barriers, services, wastewater or buildability.",
        M + 12, 111, PAGE_W - 2*M - 24, size=8.1, leading=10.5, color=INK)
    footer(c, 3)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    IMG_3D.parent.mkdir(parents=True, exist_ok=True)
    for source, target in ((IMG_3D_SOURCE, IMG_3D), (IMG_TOP_SOURCE, IMG_TOP)):
        with Image.open(source) as image:
            image.convert("RGB").resize((1800, 1125), Image.Resampling.LANCZOS).save(
                target, "JPEG", quality=86, optimize=True
            )
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("135 Fiddlers Hill Road Puhoi - preliminary property review")
    c.setAuthor("Royal Glass")
    c.setSubject("Manual desktop pool feasibility review")
    page_one(c); c.showPage()
    page_two(c); c.showPage()
    page_three(c); c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
