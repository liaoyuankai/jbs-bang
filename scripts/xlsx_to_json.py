"""Convert the old QQ online spreadsheet (dm黑榜.xlsx) into data/import.json.

Usage: python -P scripts/xlsx_to_json.py <xlsx> <out.json>

Red sheets (红榜 / 店家红榜 / 玩家红榜): column 0 is the subject, later columns are
comments; the same subject often appears on several rows, one comment per row.
Rows are grouped by subject. The first substantive cell becomes the entry body
(merged with following cells until it reaches 10 chars), the rest become comments,
"+1"-style cells become endorsements. Published on import.

The 红榜 sheet mixes DMs and shops; a name that matches a shop known from the shop
sheets is imported as a shop, "店名 DM名" is split into shop + DM, anything else is a DM.

清洗总表 is the already-consolidated black list (店家 + 玩家). Imported as pending so
the operator reviews every black entry in /admin before it goes public.

Sheets 黑榜 / 店家黑榜 / 玩家黑榜 are skipped: 黑榜 was wiped, the other two are
consolidated in 清洗总表 (店家黑榜 is still read for shop names).
"""
import json
import re
import sys
from collections import Counter, OrderedDict

import openpyxl

LOW_VALUE = re.compile(r"^(点了|同意|赞同|支持|是的|确实|没错|附议|顶|对|同|\+1|1)+$")
PUNCT = re.compile(r"[\s!！。.、，,~～?？]+")
MIN_BODY = 10
MAX_NAME = 12
CITY = "西安"


def is_low_value(text: str) -> bool:
    core = PUNCT.sub("", text)
    return bool(core) and bool(LOW_VALUE.match(core))


def cell(v) -> str:
    return str(v).strip() if v is not None else ""


def norm(name: str) -> str:
    n = re.sub(r"\s+", "", name.lower())
    if n.startswith("xa"):
        n = n[2:]
    if n.endswith("店") and len(n) > 1:
        n = n[:-1]
    return n


def split_cells(cells):
    substantive, endorsements = [], 0
    for c in cells:
        c = cell(c)
        if not c:
            continue
        if is_low_value(c):
            endorsements += 1
        else:
            substantive.append(c)
    return substantive, endorsements


def make_body(substantive):
    if not substantive:
        return None, []
    body = substantive[0]
    rest = substantive[1:]
    while len(body) < MIN_BODY and rest:
        body = f"{body}；{rest.pop(0)}"
    if len(body) < MIN_BODY:
        return None, []
    return body, rest


def red_sheet(ws, default_type, known_shops=frozenset(), split_dm_name=False):
    groups = OrderedDict()
    skipped = []
    for row in ws.iter_rows(values_only=True):
        name = cell(row[0] if row else None)
        if not name:
            continue
        if len(name) > MAX_NAME:
            skipped.append(("name-too-long", name))
            continue
        subject_type, shop_name = default_type, None
        if default_type == "dm":
            parts = name.split()
            if len(parts) >= 2 and split_dm_name:
                shop_name, name = parts[0], " ".join(parts[1:])
            elif norm(name) in known_shops:
                subject_type = "shop"
        key = (subject_type, norm(name), norm(shop_name) if shop_name else None)
        g = groups.setdefault(key, {"type": subject_type, "name": name, "shopName": shop_name, "cells": []})
        g["cells"].extend(row[1:])
    items = []
    for g in groups.values():
        substantive, endorsements = split_cells(g["cells"])
        body, comments = make_body(substantive)
        if body is None:
            skipped.append(("no-body", g["name"]))
            continue
        items.append(
            {
                "type": g["type"],
                "list": "red",
                "name": g["name"],
                "city": CITY,
                "shopName": g["shopName"],
                "category": "其他",
                "body": body,
                "comments": comments,
                "endorsements": endorsements,
                "status": "published",
            }
        )
    return items, skipped


def black_sheet(ws):
    items, skipped = [], []
    rows = list(ws.iter_rows(values_only=True))
    header = [cell(c) for c in rows[0]]
    idx = {h: i for i, h in enumerate(header) if h}
    for row in rows[1:]:
        dim = cell(row[idx["维度"]])
        if not dim:
            continue
        if dim == "店家":
            subject_type, name = "shop", cell(row[idx["店家"]])
        elif dim == "玩家":
            subject_type, name = "player", cell(row[idx["DM/玩家"]])
        else:
            skipped.append(("unknown-dim", dim))
            continue
        if not name or len(name) > MAX_NAME:
            skipped.append(("bad-name", name))
            continue
        reason = cell(row[idx["主诉原因"]])
        extra = cell(row[idx["补充评论"]])
        extra_cells = [p.strip() for p in extra.split(" / ")] if extra else []
        substantive, endorsements = split_cells(extra_cells)
        body, comments = make_body(([reason] if reason else []) + substantive)
        if body is None:
            skipped.append(("no-body", name, reason))
            continue
        items.append(
            {
                "type": subject_type,
                "list": "black",
                "name": name,
                "city": CITY,
                "shopName": None,
                "category": "其他",
                "body": body,
                "comments": comments,
                "endorsements": endorsements,
                "status": "pending",
            }
        )
    return items, skipped


def shop_names(wb):
    names = set()
    for title in ("店家红榜", "店家黑榜"):
        if title in wb.sheetnames:
            for row in wb[title].iter_rows(values_only=True):
                n = cell(row[0] if row else None)
                if n and len(n) <= MAX_NAME:
                    names.add(norm(n))
    if "清洗总表" in wb.sheetnames:
        rows = list(wb["清洗总表"].iter_rows(values_only=True))
        header = [cell(c) for c in rows[0]]
        if "店家" in header:
            i = header.index("店家")
            for row in rows[1:]:
                n = cell(row[i])
                if n and len(n) <= MAX_NAME:
                    names.add(norm(n))
    return frozenset(names)


def main(src, out):
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    shops = shop_names(wb)
    print(f"known shop names: {len(shops)}")
    items, skipped = [], []
    plan = {
        "店家红榜": lambda ws: red_sheet(ws, "shop"),
        "玩家红榜": lambda ws: red_sheet(ws, "player"),
        "红榜": lambda ws: red_sheet(ws, "dm", known_shops=shops, split_dm_name=True),
        "清洗总表": black_sheet,
    }
    for title, fn in plan.items():
        if title not in wb.sheetnames:
            print(f"missing sheet: {title}")
            continue
        got, sk = fn(wb[title])
        items += got
        skipped += [(title, *s) for s in sk]
        print(f"{title}: {len(got)} items, {len(sk)} skipped")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    counts = Counter((i["type"], i["list"], i["status"]) for i in items)
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")
    print(f"total {len(items)} -> {out}")
    for s in skipped:
        print(f"  skipped {s}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2])
