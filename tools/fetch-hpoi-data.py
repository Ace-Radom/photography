import json
import os
import re
import requests

from pathlib import Path


def get_root_dir() -> Path:
    script_path = Path(__file__).resolve()
    current_dir = script_path.parent
    parent_dir = current_dir.parent
    if current_dir.name == "tools":
        return parent_dir
    return current_dir


def get_data_from_html(
    html: str,
    anchors: list[str],
    target_str_begin: str,
    target_str_end: str,
    with_possible_hyperlink: bool = False,
) -> str:
    search_begin_pos = 0
    for anchor in anchors:
        anchor_pos = html.find(anchor, search_begin_pos)
        if anchor_pos == -1:
            print(f"WARNING: cannot find anchor '{anchor}'.")
            return ""
        search_begin_pos = anchor_pos + len(anchor)

    target_str_begin_pos = html.find(target_str_begin, search_begin_pos)
    if target_str_begin_pos == -1:
        print(
            f"WARNING: cannot find target str begin '{target_str_begin}' after anchor '{anchor}'."
        )
        return ""
    target_str_begin_pos += len(target_str_begin)
    target_str_end_pos = html.find(target_str_end, target_str_begin_pos)
    if target_str_end_pos == -1:
        print(
            f"WARNING: cannot find target str end '{target_str_end}' after target str begin '{target_str_begin}'."
        )
        return ""

    data_str = html[target_str_begin_pos:target_str_end_pos]
    if not with_possible_hyperlink:
        return data_str

    pattern = r"<a\b[^>]*>(.*?)</a>"
    return re.sub(pattern, r"\1", data_str, flags=re.DOTALL | re.IGNORECASE)


def extract_date_numbers(date_str: str) -> tuple[int, int, int]:
    numbers = re.findall(r"\d+", date_str)
    if len(numbers) >= 3:
        year = int(numbers[0])
        month = int(numbers[1])
        day = int(numbers[2])
        return year, month, day
    else:
        print(f"ERROR: invalid date str '{date_str}'.")
        exit(1)


def main() -> None:
    root_dir = get_root_dir()
    assets_dir = root_dir / "assets"
    if not assets_dir.is_dir():
        print("ERROR: assets dir doesn't exist.")
        exit(1)

    figure_photos = []
    meta_path = assets_dir / "meta.json"
    with open(meta_path, "r", encoding="utf-8") as rfile:
        figure_photos = json.load(rfile)["figure"]

    hpoi_ids = []
    for photo in figure_photos:
        this_hpoi_id = photo["hpoi-id"]
        if this_hpoi_id not in hpoi_ids:
            hpoi_ids.append(this_hpoi_id)
    hpoi_ids.sort()

    print(f"Fetch datas from Hpoi: {hpoi_ids}")

    hpoi_datas = {}
    for id in hpoi_ids:
        this_url = f"https://www.hpoi.net/hobby/{id}"
        html_str = ""

        print(f"Fetching data from Hpoi: {this_url}")
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
                "Referer": "https://www.hpoi.net/search",
            }
            response = requests.get(this_url, headers=headers, timeout=10)
            response.raise_for_status()
            html_str = response.text
        except Exception as e:
            print(f"ERROR: exception caught when requesting data {id}: {e}")
            exit(1)

        title = get_data_from_html(
            html_str,
            anchors=['<div class="row">', '<div class="hpoi-ibox-title">'],
            target_str_begin='<p title="',
            target_str_end='">',
        )

        official_img_url = get_data_from_html(
            html_str,
            anchors=[
                '<div class="row">',
                '<div class="hpoi-ibox-title">',
                '<div class="hpoi-ibox-img">',
                "<img alt=",
            ],
            target_str_begin='src="',
            target_str_end='">',
        )
        if official_img_url.find("?") != -1:
            official_img_url = official_img_url[: official_img_url.find("?")]

        original_title = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>名称</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
        )

        price = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>定价</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
        )

        shipment_date_str = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>出货日</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )
        (
            shipment_date_year,
            shipment_date_month,
            shipment_date_day,
        ) = extract_date_numbers(shipment_date_str)

        ratio = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>比例</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        manufacture = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>制作</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        series = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>系列</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        prototype = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>原型</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        painting = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>涂装</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        character = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>角色</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        work = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>作品</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
            with_possible_hyperlink=True,
        )

        size = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>尺寸</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
        )

        material = get_data_from_html(
            html_str,
            anchors=['<div class="infoList-box">', "<span>材质</span>"],
            target_str_begin="<p>",
            target_str_end="</p>",
        )

        this_hpoi_data = {
            "hpoi_url": this_url,
            "title": title,
            "original_title": original_title,
            "official_img_url": official_img_url,
            "price": price,
            "shipment_date_year": shipment_date_year,
            "shipment_date_month": shipment_date_month,
            "shipment_date_day": shipment_date_day,
            "ratio": ratio,
            "manufacture": manufacture,
            "series": series,
            "prototype": prototype,
            "painting": painting,
            "character": character,
            "work": work,
            "size": size,
            "material": material,
        }

        hpoi_datas[id] = this_hpoi_data

    hpoi_path = assets_dir / "hpoi.json"
    with open(hpoi_path, 'w', encoding='utf-8') as wfile:
        json.dump(hpoi_datas, wfile, indent=4, ensure_ascii=False)

    return

if __name__ == "__main__":
    main()
