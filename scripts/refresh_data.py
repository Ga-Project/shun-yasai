#!/usr/bin/env python3
"""農林水産省「食品価格動向調査（野菜）」の公開 Excel を data/prices.json に取り込む。

公開データの更新は原則として火曜日。取り込みたいときに手で実行する:

    python3 scripts/refresh_data.py

ビルド時にはこのスクリプトを動かさない（生成済みの data/prices.json だけを読む）。
サイトのビルドを外部サイトの生死に依存させないため、また調査元へ不要なアクセスを
繰り返さないため。

依存は Python 標準ライブラリのみ（xlsx は zip + XML なので自前で読む）。
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

SOURCE_PAGE = "https://www.maff.go.jp/j/zyukyu/anpo/kouri/k_yasai/h22index.html"
SOURCE_XLSX = "https://www.maff.go.jp/j/zyukyu/anpo/kouri/k_yasai/attach/xls/h22index-204.xlsx"
USER_AGENT = "shun-yasai-data-refresh/1.0 (+https://ga-project.github.io/shun-yasai/)"

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

# 調査対象の 10 品目。表の列順と一致させる（列は B 列から順に並ぶ）。
ITEMS = [
    ("cabbage", "キャベツ"),
    ("negi", "ねぎ"),
    ("lettuce", "レタス"),
    ("potato", "ばれいしょ"),
    ("onion", "たまねぎ"),
    ("cucumber", "きゅうり"),
    ("tomato", "トマト"),
    ("carrot", "にんじん"),
    ("hakusai", "はくさい"),
    ("daikon", "だいこん"),
]

# 単位は品目ごとではなく表全体で1つ。見出し（A1）に「単位：円/kg」と書かれているので
# そこから読み、想定と違えば停止する。単位を決め打ちで持つと、公開元が単位を変えたときに
# 桁が違う数字を正しい単位のふりをして表示してしまう。
UNIT_RE = re.compile(r"単位[:：]\s*([^）)]+)")
EXPECTED_UNIT = "円/kg"

# 「令和3年4月5日の週」→ 2021-04-05
WEEK_RE = re.compile(r"令和(\d+)年(\d+)月(\d+)日の週")
REIWA_EPOCH = 2018  # 令和 N 年 = 2018 + N


def col_of(ref: str) -> int:
    """"B12" のようなセル参照から 1 始まりの列番号を返す。"""
    letters = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - ord("A") + 1)
    return n


def load_shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    out = []
    for si in root.findall("m:si", NS):
        # <si> の下に散らばる <t> を連結する（書式で分割されることがある）
        out.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    return out


def sheet_paths(z: zipfile.ZipFile) -> dict[str, str]:
    """シート名 -> zip 内のパス。"""
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    by_id = {
        rel.get("Id"): "xl/" + rel.get("Target").lstrip("/")
        for rel in rels
    }
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    out = {}
    for sheet in wb.find("m:sheets", NS):
        rid = sheet.get(f"{{{NS['r']}}}id")
        out[sheet.get("name")] = by_id[rid]
    return out


def read_grid(z: zipfile.ZipFile, path: str, shared: list[str]) -> dict[int, dict[int, str]]:
    """シートを {行番号: {列番号: 文字列}} で返す。"""
    root = ET.fromstring(z.read(path))
    grid: dict[int, dict[int, str]] = {}
    for row in root.iter(f"{{{NS['m']}}}row"):
        r = int(row.get("r"))
        cells: dict[int, str] = {}
        for c in row.findall("m:c", NS):
            ref = c.get("r") or ""
            v = c.find("m:v", NS)
            if c.get("t") == "inlineStr":
                is_el = c.find("m:is", NS)
                text = "".join(t.text or "" for t in is_el.iter(f"{{{NS['m']}}}t")) if is_el is not None else ""
            elif v is None:
                continue
            elif c.get("t") == "s":
                text = shared[int(v.text)]
            else:
                text = v.text or ""
            if text != "":
                cells[col_of(ref)] = text
        if cells:
            grid[r] = cells
    return grid


# 公開元が使う欠測記号。これ以外の読めない文字列は、黙って欠測に変えず取り込みを止める
# （脚注記号付きの "224 *" のような値を「調査対象外」として出してしまわないため）。
MISSING_MARKS = ("", "-", "－", "‐", "―", "…", "×", "※")


class UnreadableValue(Exception):
    """欠測記号でも数値でもない値。取り込みを止める。"""


def to_number(raw: str | None):
    """欠測記号と空欄は None。数値でも欠測記号でもなければ例外を投げる。"""
    if raw is None:
        return None
    s = raw.strip().replace(",", "")
    if s in MISSING_MARKS:
        return None
    try:
        return float(s)
    except ValueError as exc:
        raise UnreadableValue(s) from exc


def looks_like_data_row(cells: dict[int, str]) -> bool:
    """品目の列に数値が1つでも入っていれば、データ行とみなす。"""
    for i in range(len(ITEMS)):
        raw = cells.get(i + 2)
        if raw is None:
            continue
        try:
            float(raw.strip().replace(",", ""))
        except ValueError:
            continue
        return True
    return False


def parse_week(label: str | None) -> str | None:
    if not label:
        return None
    m = WEEK_RE.search(label.replace("　", "").strip())
    if not m:
        return None
    era_year, month, day = (int(g) for g in m.groups())
    try:
        return dt.date(REIWA_EPOCH + era_year, month, day).isoformat()
    except ValueError:
        return None


def main() -> int:
    here = pathlib.Path(__file__).resolve().parent.parent
    req = urllib.request.Request(SOURCE_XLSX, headers={"User-Agent": USER_AGENT})
    print(f"取得中: {SOURCE_XLSX}", file=sys.stderr)
    with urllib.request.urlopen(req, timeout=60) as resp:
        blob = resp.read()
    print(f"  {len(blob):,} bytes", file=sys.stderr)

    import io

    z = zipfile.ZipFile(io.BytesIO(blob))
    shared = load_shared_strings(z)
    paths = sheet_paths(z)
    for required in ("価格", "平年比"):
        if required not in paths:
            print(f"想定したシート「{required}」が無い。元データの構成が変わった可能性がある。", file=sys.stderr)
            return 1

    price_grid = read_grid(z, paths["価格"], shared)
    ratio_grid = read_grid(z, paths["平年比"], shared)

    # 単位を表題（A1）から読む。「食品価格動向調査（野菜）の結果（価格、単位：円/kg）」の形。
    # 全品目が同一単位なので、品目ごとに単位を持たない。公開元が単位を変えた場合は
    # 桁の意味が変わるため、想定と違えば取り込みを止める。
    title = price_grid.get(1, {}).get(1, "")
    unit_match = UNIT_RE.search(title)
    if not unit_match:
        print(f"表題から単位を読めなかった: {title!r}", file=sys.stderr)
        return 1
    unit = unit_match.group(1).strip()
    if unit != EXPECTED_UNIT:
        print(
            f"単位が「{unit}」で、想定の「{EXPECTED_UNIT}」と違う。"
            "公開元が単位を変えた可能性があるため取り込みを中止する。",
            file=sys.stderr,
        )
        return 1

    # 見出し行（品目名）が想定と一致するかを確認する。ずれたまま取り込むと
    # 別の品目の値を表示してしまうので、ここで必ず落とす。
    # 価格シートだけでなく平年比シートも検査する。平年比は本サイトの中核の値で、
    # 列順がずれれば別の野菜の「買い時」を表示することになる。
    def check_header(grid, sheet_name: str) -> bool:
        header = grid.get(2, {})
        for idx, (_item_id, name) in enumerate(ITEMS):
            col = idx + 2  # B 列から
            if header.get(col, "").strip() != name:
                print(
                    f"[{sheet_name}] 列 {col} の見出しが「{header.get(col)}」で、"
                    f"想定の「{name}」と違う。元データの列順が変わった可能性がある。",
                    file=sys.stderr,
                )
                return False
        return True

    if not check_header(price_grid, "価格"):
        return 1
    if not check_header(ratio_grid, "平年比"):
        return 1

    weeks: list[str] = []
    series: dict[str, list[dict]] = {item_id: [] for item_id, _ in ITEMS}

    for r in sorted(price_grid):
        prices = price_grid[r]
        week = parse_week(prices.get(1))

        if week is None:
            # 週ラベルが読めない行。表題・見出し・注記なら飛ばしてよいが、
            # 数値が並んでいるなら「元号が変わって週を読めなくなった」等の疑いがある。
            # 黙って捨てると新しい週が1行も入らないまま成功終了してしまう。
            if looks_like_data_row(prices):
                print(
                    f"価格シート {r} 行目は数値が並んでいるのに週を読めない: {prices.get(1)!r}。"
                    "元号の変更などで表記が変わった可能性があるため中止する。",
                    file=sys.stderr,
                )
                return 1
            continue

        try:
            row_values = [to_number(prices.get(i + 2)) for i in range(len(ITEMS))]
        except UnreadableValue as exc:
            print(
                f"価格シート {r} 行目に読めない値がある: {exc}。"
                "欠測として扱うと実在した価格を『調査対象外』として公開してしまうため中止する。",
                file=sys.stderr,
            )
            return 1

        if all(v is None for v in row_values):
            continue

        # 平年比シートは行番号ではなく週ラベルで突き合わせる。
        # 注記行が1行増減しただけで全品目の平年比が数週ずれるため。
        ratios = ratio_grid.get(r, {})
        ratio_week = parse_week(ratios.get(1))
        if ratio_week != week:
            print(
                f"平年比シート {r} 行目の週が「{ratio_week}」で、価格シートの「{week}」と揃わない。"
                "行の対応が崩れているため中止する。",
                file=sys.stderr,
            )
            return 1

        if weeks and week <= weeks[-1]:
            print(
                f"週が昇順でない（{weeks[-1]} のあとに {week}）。"
                "並び順が変わると最新週の判定が壊れるため中止する。",
                file=sys.stderr,
            )
            return 1

        try:
            ratio_values = [to_number(ratios.get(i + 2)) for i in range(len(ITEMS))]
        except UnreadableValue as exc:
            print(f"平年比シート {r} 行目に読めない値がある: {exc}。中止する。", file=sys.stderr)
            return 1

        # 平年比の桁が変わっていないか（百分率表記への変更などを検出する）。
        for idx, value in enumerate(ratio_values):
            if value is None:
                continue
            if not (0.2 <= value <= 5.0):
                print(
                    f"{ITEMS[idx][1]} {week} の平年比が {value} で想定の範囲(0.2〜5.0)から外れる。"
                    "公開元が百分率表記へ変えた可能性があるため中止する。",
                    file=sys.stderr,
                )
                return 1

        weeks.append(week)
        for idx, (item_id, _) in enumerate(ITEMS):
            series[item_id].append(
                {
                    "week": week,
                    "price": row_values[idx],
                    "ratio": ratio_values[idx],
                }
            )

    if not weeks:
        print("週次データを1行も読めなかった。", file=sys.stderr)
        return 1

    payload = {
        "source": {
            "name": "農林水産省「食品価格動向調査（野菜）」",
            "page": SOURCE_PAGE,
            "file": SOURCE_XLSX,
            "licence": "政府標準利用規約（第2.0版）に基づく出典表示を条件とした利用",
            "retrieved": dt.date.today().isoformat(),
            "unit": unit,
            "note": "全国470店舗の訪問調査。特売価格等を含まない消費税込み価格の単純平均（全国平均）。",
        },
        "items": [{"id": item_id, "name": name} for item_id, name in ITEMS],
        "weeks": weeks,
        "series": series,
    }

    out = here / "data" / "prices.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"書き出し: {out} （{len(weeks)} 週 × {len(ITEMS)} 品目）", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
