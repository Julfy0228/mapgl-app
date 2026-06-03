import json
from pathlib import Path

source_path = Path("src/data/tulskaia-oblast.geojson")
result_path = Path("src/data/dtp-tula.geojson")

with source_path.open("r", encoding="utf-8-sig") as file:
    data = json.load(file)

data["features"] = data.get("features", [])[:1000]

with result_path.open("w", encoding="utf-8") as file:
    json.dump(data, file, ensure_ascii=False)
