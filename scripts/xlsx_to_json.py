"""Convert the old QQ online spreadsheet (dm黑榜.xlsx) into data/import.json.

Usage: python -P scripts/xlsx_to_json.py <xlsx> <out.json>

Red sheets (红榜 / 店家红榜 / 玩家红榜): column 0 is the subject, later columns are
comments; the same subject often appears on several rows, one comment per row.
Rows are grouped by subject. Every cell is its own "floor": the first substantive
cell becomes the entry body (however short), each later cell becomes one comment,
"+1"-style cells become endorsements. Published on import.

The 红榜 sheet mixes DMs and shops; a name that matches a shop known from the shop
sheets is imported as a shop, "店名 DM名" is split into shop + DM, anything else is a DM.
Earlier snapshots of the sheet use three columns (店名 | DM名 | 评论): a short name-like
second cell followed by a comment is read as shop + DM.

清洗总表 is the already-consolidated black list (店家 + 玩家). Published on import like
everything else (the site is post-moderated; takedowns happen via reports).

黑榜 is the DM black list. Earlier snapshots are one column of names (a name listed
several times counts as several people); later snapshots are 店名 | dm plus chatter.
Names are matched against the known shops to split 店名+DM名; rows without any
reason text get a fixed placeholder body saying the sheet gave none.

店家黑榜 / 玩家黑榜 are consolidated in 清洗总表 (店家黑榜 is still read for shop names).
"""
import json
import re
import sys
from collections import Counter, OrderedDict

import openpyxl

LOW_VALUE = re.compile(r"^(点了|同意|赞同|支持|是的|确实|没错|附议|顶|对|同|\+1|1)+$")
PUNCT = re.compile(r"[\s!！。.、，,~～?？]+")
SENTENCE = re.compile(r"[\s，。！？,.!?；;：:…]")
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


MAX_DM_NAME = 8
SENTENCE_WORDS = re.compile(r"[的我你是了啊呀]")


def name_like(text: str) -> bool:
    """A DM name in its own column: short, no sentence punctuation or function words, not a +1."""
    return (
        0 < len(text) <= MAX_DM_NAME
        and not SENTENCE.search(text)
        and not SENTENCE_WORDS.search(text)
        and not is_low_value(text)
    )


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
    """Each cell is one floor: first cell = body, the rest = comments. No merging."""
    if not substantive:
        return None, []
    return substantive[0], substantive[1:]


RANT = re.compile(r"删|控评|瓜|解码|明天|傻|黄|网站|备份|急|哈哈|想看|无语|别发|发生什么|怎么全|手机问题|沃德|何意味|圈外|玩不起|短一截|别点|赚钱|牛逼坏|gg|乱填|还有吗|有没|野d|夫妻车|^[?？。]+$")
DM_BLACK_PLACEHOLDER = "原表格「DM 黑榜」中被人列出，表里没有写事由。"
RAW_SHOPS: list = []


def split_shop_dm(name: str, known_shops):
    """'xa己店阿丁' -> ('阿丁', 'xa己店'); '戊店' -> (None, '戊店') meaning the shop itself; else (name, None)."""
    n = re.sub(r"\s+", "", name.lower())
    if norm(name) in known_shops:
        return None, name
    # 前xx / 原xx / 现xx = the shop itself, mentioned as former or current workplace
    if len(name) > 1 and name[0] in "前原现新" and norm(name[1:]) in known_shops:
        return None, name[1:]
    for shop in sorted(RAW_SHOPS, key=len, reverse=True):
        sl = re.sub(r"\s+", "", shop.lower())
        if len(sl) < 2 or len(n) <= len(sl):
            continue
        if n.startswith(sl):
            return name[len(shop):].strip(" /／-—:："), shop
        if n.endswith(sl):
            return name[: len(name) - len(shop)].strip(" /／-—:："), shop
    return name, None


def dm_black_sheet(ws, known_shops):
    """Columns: A 店名, B dm, C.. 原因 (one floor per cell). A long B cell is a floor, not a name."""
    groups = OrderedDict()
    skipped = []
    for row in ws.iter_rows(values_only=True):
        vals = [cell(c) for c in row]
        name = vals[0] if vals else ""
        dm_cell = vals[1] if len(vals) > 1 else ""
        rest = [c for c in vals[2:] if c]
        if not name and not dm_cell and not rest:
            continue
        if name in ("店名4", "店名", "dm", "DM"):
            continue
        if not name:
            skipped.append(("no-shop", dm_cell or rest[0]))
            continue
        if len(name) > MAX_NAME or RANT.search(name):
            skipped.append(("rant-or-long", name))
            continue
        dm, shop = split_shop_dm(name, known_shops)
        if dm_cell:
            if name_like(dm_cell) and not RANT.search(dm_cell):
                dm, shop = dm_cell, name
            else:
                rest = [dm_cell, *rest]
        if dm is None:
            key, item = ("shop", norm(shop), None), {"type": "shop", "name": shop, "shopName": None}
        else:
            key, item = ("dm", norm(dm), norm(shop) if shop else None), {"type": "dm", "name": dm, "shopName": shop}
        g = groups.setdefault(key, {**item, "floors": [], "mentions": 0})
        g["mentions"] += 1
        g["floors"].extend(c for c in rest if not RANT.search(c))
    items = []
    for g in groups.values():
        substantive, endorsements = split_cells(g["floors"])
        body, comments = make_body(substantive)
        if body is None:
            body = DM_BLACK_PLACEHOLDER
        items.append(
            {
                "type": g["type"],
                "list": "black",
                "name": g["name"],
                "city": CITY,
                "shopName": g["shopName"],
                "category": "其他",
                "body": body,
                "comments": comments,
                "endorsements": endorsements + g["mentions"] - 1,
                "floors": [body, *comments],
                "status": "published",
            }
        )
    return items, skipped


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
        rest = list(row[1:])
        if default_type == "dm":
            parts = name.split()
            second = cell(rest[0]) if rest else ""
            third = cell(rest[1]) if len(rest) > 1 else ""
            if split_dm_name and name_like(second) and len(third) >= 2:
                # three-column layout: 店名 | DM名 | 评论
                shop_name, name, rest = name, second, rest[1:]
            elif len(parts) >= 2 and split_dm_name:
                shop_name, name = parts[0], " ".join(parts[1:])
            elif norm(name) in known_shops:
                subject_type = "shop"
        key = (subject_type, norm(name), norm(shop_name) if shop_name else None)
        g = groups.setdefault(key, {"type": subject_type, "name": name, "shopName": shop_name, "cells": []})
        g["cells"].extend(rest)
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
                "floors": substantive,
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
        floors = ([reason] if reason else []) + substantive
        body, comments = make_body(floors)
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
                "floors": floors,
                "status": "published",
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
                    if n not in RAW_SHOPS:
                        RAW_SHOPS.append(n)
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
    # not read_only: this export omits cell references and read-only mode silently drops most columns
    wb = openpyxl.load_workbook(src, data_only=True)
    shops = shop_names(wb)
    print(f"known shop names: {len(shops)}")
    items, skipped = [], []
    plan = {
        "店家红榜": lambda ws: red_sheet(ws, "shop"),
        "玩家红榜": lambda ws: red_sheet(ws, "player"),
        "红榜": lambda ws: red_sheet(ws, "dm", known_shops=shops, split_dm_name=True),
        "黑榜": lambda ws: dm_black_sheet(ws, shops),
        "清洗总表": black_sheet,
    }
    for title, fn in plan.items():
        if title == "黑榜":
            # every shop the red sheets revealed (as a DM's shop, or as a shop subject) helps split 店名+DM名
            more = set()
            for it in items:
                if it.get("shopName"):
                    more.add(it["shopName"])
                if it["type"] == "shop":
                    more.add(it["name"])
            for n in sorted(more):
                if n not in RAW_SHOPS:
                    RAW_SHOPS.append(n)
            shops = frozenset(shops | {norm(n) for n in more})
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
