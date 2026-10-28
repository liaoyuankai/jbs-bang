"""Keep only the texts of a converted snapshot that are not already in a previous import.

Usage: python -X utf8 scripts/filter_new.py <new.json> <already-imported.json> <out.json>

Snapshots of the same sheet group rows differently, so matching is by text, not by
subject: any body or comment whose normalized text already appears anywhere in the
previously imported data is dropped. What is left is regrouped into body + comments
with the same 10-char body rule as the converter, so the importer's own hash check
is only a second line of defence.
"""
import json
import re
import sys
from collections import Counter

MIN_BODY = 10
PROBE = 12


def norm(t: str) -> str:
    return re.sub(r"[\s，。！？,.!?；;：:~～…]+", "", t).lower()


def main(new_path, old_path, out_path):
    new = json.load(open(new_path, encoding="utf-8"))
    old = json.load(open(old_path, encoding="utf-8"))
    hay = "\n".join(norm(t) for i in old for t in [i["body"], *i["comments"]])

    def seen(t: str) -> bool:
        n = norm(t)
        return bool(n) and n[:PROBE] in hay

    kept, dropped_items, dropped_texts, kept_texts = [], 0, 0, 0
    for item in new:
        fresh = [t for t in [item["body"], *item["comments"]] if not seen(t)]
        dropped_texts += 1 + len(item["comments"]) - len(fresh)
        if not fresh:
            dropped_items += 1
            continue
        body, rest = fresh[0], fresh[1:]
        while len(body) < MIN_BODY and rest:
            body = f"{body}；{rest.pop(0)}"
        if len(body) < MIN_BODY:
            dropped_items += 1
            continue
        kept_texts += 1 + len(rest)
        kept.append({**item, "body": body, "comments": rest, "endorsements": 0})
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, indent=1)
    print(f"items: {len(new)} in, {len(kept)} kept, {dropped_items} dropped; texts: {kept_texts} new, {dropped_texts} already imported")
    for k, v in sorted(Counter((i["list"], i["type"]) for i in kept).items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    main(*sys.argv[1:])
