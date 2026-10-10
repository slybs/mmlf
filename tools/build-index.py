#!/usr/bin/env python3
"""Scans reports/<sector>/*.html and writes data/reports.js.

Cross-platform equivalent of tools/build-index.ps1 (for macOS / Linux).
Usage:  python3 tools/build-index.py
"""
import html
import json
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS_DIR = os.path.join(ROOT, "reports")
OUT_FILE = os.path.join(ROOT, "data", "reports.js")

# PowerShell ConvertTo-Json emits a peculiar indent scheme; match it so the
# generated file stays byte-identical to what build-index.ps1 produces.
INDENT_OBJ = 4      # sector object inside the top-level array
INDENT_KEY = 8      # keys of a sector object
INDENT_ITEM = 24    # report object inside "reports"
INDENT_RKEY = 28    # keys of a report object
INDENT_ARR_END = 20 # closing bracket of "reports"


def get_meta(text, name):
    m = re.search(r'<meta\s+name="' + name + r'"\s+content="([^"]*)"', text, re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def esc(value):
    return json.dumps(value, ensure_ascii=False)


def kv(indent, key, value):
    return " " * indent + esc(key) + ":  " + esc(value)


def existing_order():
    """Names already present in data/reports.js, in their current order.

    Used as a tie-breaker so re-running the script never reshuffles sectors
    that share the same `latest` date. Unknown (new) sectors sort first.
    """
    try:
        with open(OUT_FILE, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return []
    return re.findall(r'^ {8}"name":  "(.*?)",$', text, re.M)


def collect():
    sectors = []
    for name in sorted(os.listdir(REPORTS_DIR)):
        d = os.path.join(REPORTS_DIR, name)
        if name.startswith("_") or not os.path.isdir(d):
            continue

        desc, group = "", "sector"
        cfg = os.path.join(d, "_sector.json")
        if os.path.isfile(cfg):
            with open(cfg, encoding="utf-8") as f:
                conf = json.load(f)
            desc = conf.get("desc", "")
            group = conf.get("group", "sector")

        reports = []
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".html"):
                continue
            path = os.path.join(d, fn)
            if not os.path.isfile(path):
                continue

            with open(path, encoding="utf-8") as f:
                text = f.read()

            base = os.path.splitext(fn)[0]
            m = re.match(r"^(\d{4})(\d{2})(\d{2})_?(.*)$", base)
            if m:
                date = "%s-%s-%s" % (m.group(1), m.group(2), m.group(3))
                topic = m.group(4)
            else:
                date = time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(path)))
                topic = base

            t = re.search(r"<title>([\s\S]*?)</title>", text, re.I)
            title = html.unescape(t.group(1)).strip() if t else topic
            # strip a trailing "| 2026-10-09" / "· 2026-10-09" from the title
            title = re.sub(r"\s*[|\u00b7]\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}\s*$", "", title)

            reports.append(
                {
                    "title": title,
                    "date": date,
                    "type": get_meta(text, "report-type"),
                    "file": "reports/" + name + "/" + fn,
                    "summary": get_meta(text, "description"),
                }
            )

        if not reports:
            continue
        reports.sort(key=lambda r: r["date"], reverse=True)
        sectors.append(
            {
                "name": name,
                "group": group,
                "desc": desc,
                "latest": reports[0]["date"],
                "reports": reports,
            }
        )

    # Minor key first (stable sort): keep the order already in data/reports.js,
    # with brand-new sectors (-1) placed ahead of same-date existing ones.
    order = {name: i for i, name in enumerate(existing_order())}
    sectors.sort(key=lambda s: order.get(s["name"], -1))
    sectors.sort(key=lambda s: s["latest"], reverse=True)
    return sectors


def render(sectors):
    out = ["window.SECTORS = ["]
    for i, s in enumerate(sectors):
        out.append(" " * INDENT_OBJ + "{")
        out.append(kv(INDENT_KEY, "name", s["name"]) + ",")
        out.append(kv(INDENT_KEY, "group", s["group"]) + ",")
        out.append(kv(INDENT_KEY, "desc", s["desc"]) + ",")
        out.append(kv(INDENT_KEY, "latest", s["latest"]) + ",")
        out.append(" " * INDENT_KEY + esc("reports") + ":  [")

        for j, r in enumerate(s["reports"]):
            tail = "," if j < len(s["reports"]) - 1 else ""
            out.append(" " * INDENT_ITEM + "{")
            out.append(kv(INDENT_RKEY, "title", r["title"]) + ",")
            out.append(kv(INDENT_RKEY, "date", r["date"]) + ",")
            out.append(kv(INDENT_RKEY, "type", r["type"]) + ",")
            out.append(kv(INDENT_RKEY, "file", r["file"]) + ",")
            out.append(kv(INDENT_RKEY, "summary", r["summary"]))
            out.append(" " * INDENT_ITEM + "}" + tail)

        out.append(" " * INDENT_ARR_END + "]")
        out.append(" " * INDENT_OBJ + "}" + ("," if i < len(sectors) - 1 else ""))
    out.append("];")
    return "\n".join(out) + "\n"


def main():
    sectors = collect()
    with open(OUT_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(render(sectors))
    total = sum(len(s["reports"]) for s in sectors)
    print("OK: %d sectors, %d reports -> data/reports.js" % (len(sectors), total))


if __name__ == "__main__":
    main()
