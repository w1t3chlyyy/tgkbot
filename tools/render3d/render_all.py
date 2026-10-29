"""Рендерит библиотеку 3D-объектов (объект × надпись на ленте) в assets/3d/*.png.
Нужно: pip install playwright pillow && playwright install chromium; npm i three@0.160.0 (в этой папке)
Запуск: python3 tools/render3d/render_all.py [объект] [надпись]
"""
import base64, io, os, sys, threading, http.server, socketserver, tempfile, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OBJECTS = ["star", "coin", "cube", "sphere"]
WORDS = {"скидка": "skidka", "конкурс": "konkurs", "новинка": "novinka", "кейсы": "keysy", "вакансия": "vakansiya", "hustlify": "hustlify"}

def main():
    only_obj = sys.argv[1] if len(sys.argv) > 1 else None
    only_word = sys.argv[2] if len(sys.argv) > 2 else None
    tmp = Path(tempfile.mkdtemp())
    shutil.copy(HERE / "scene.html", tmp / "scene.html")
    (tmp / "node_modules").symlink_to(HERE / "node_modules")
    (tmp / "fonts").symlink_to(ROOT / "assets" / "fonts")
    os.chdir(tmp)
    handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(tmp), **k)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 8799), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = ROOT / "assets" / "3d"; out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1400, "height": 1400})
        pg.on("pageerror", lambda e: print("page error:", e))
        pg.goto("http://127.0.0.1:8799/scene.html"); pg.wait_for_function("window.__ready===true", timeout=90000)
        for o in OBJECTS:
            for w, slug in WORDS.items():
                if (only_obj and o != only_obj) or (only_word and only_word not in (w, slug)): continue
                d = pg.evaluate(f"window.renderObject({o!r},{w!r})")
                im = Image.open(io.BytesIO(base64.b64decode(d.split(",")[1]))).convert("RGBA")
                im = im.crop(im.getbbox()).resize((1, 1)) if False else im
                im.resize((1100, 1100), Image.LANCZOS).save(out / f"{o}_{slug}.png", optimize=True)
                print("ok", o, slug)
        b.close()
    srv.shutdown()

if __name__ == "__main__":
    main()
