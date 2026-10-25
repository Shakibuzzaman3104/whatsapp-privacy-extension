#!/usr/bin/env python3
"""Composes Chrome Web Store assets from real captures (design/store/raw) and the GPT hero art.
Text is real HTML type, never painted by the image model."""
import pathlib, subprocess, tempfile
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "design/store/raw", ROOT / "design/store/final"
HERO = ROOT / "design/store/hero/mockup_v2.png"
LOGO = (ROOT / "design/icon/svg/veil.svg").read_text()
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT.mkdir(parents=True, exist_ok=True)

BASE = """<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:%(w)dpx;height:%(h)dpx;overflow:hidden}
body{background:#F5F0E9;color:#1F2A22;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.heading{font-weight:700;letter-spacing:-.025em}
.muted{color:#5F665F}.accent{color:#356B3B}
.shot{border-radius:14px;box-shadow:0 30px 70px rgba(31,42,34,.18),0 0 0 1px rgba(31,42,34,.06);display:block}
.logo svg{width:100%%;height:100%%}
</style><body>%(body)s</body>"""

SIZED = ROOT / "design/store/.sized"
SIZED.mkdir(exist_ok=True)

def sized(img, width=None, height=None):
    """Pre-scales a capture to its exact display size (headless Chrome mis-draws big downscales)."""
    im = Image.open(RAW / img)
    if width: height = round(im.height * width / im.width)
    else: width = round(im.width * height / im.height)
    out = SIZED / f"{pathlib.Path(img).stem}-{width}x{height}.png"
    im.resize((width, height), Image.LANCZOS).save(out)
    return f"file://{out}", width, height

def render(name, w, h, body):
    html = BASE % {"w": w, "h": h, "body": body}
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", f"--screenshot={OUT / name}", f"file://{f.name}"],
                   check=True, capture_output=True)
    print(OUT / name)

def screenshot(name, title, sub, img, width=1060):
    render(name, 1280, 800, f"""
      <div style="padding:44px 0 0;text-align:center">
        <div class="heading" style="font-size:40px">{title}</div>
        <div class="muted" style="font-size:19px;margin-top:8px">{sub}</div>
      </div>
      <img class="shot" src="{sized(img, width=width)[0]}" style="margin:34px auto 0">""")

screenshot("1-all-but-identity.png", "Everything blurred, except who it’s from",
           "Names and photos stay sharp. Hover a chat or a message to read it.", "all-but-identity.png")
screenshot("2-sensitive.png", "Private details stay hidden, automatically",
           "One-time codes, card numbers, passwords and bKash alerts, even with blur off.", "sensitive.png")
screenshot("3-cover.png", "Step away, stay covered",
           "Veil covers your chats when you go idle, or the moment you press Alt+Shift+V. Add a PIN to lock them.", "cover.png")
render("4-controls.png", 1280, 800, f"""
  <div style="display:flex;gap:56px;align-items:center;height:100%;padding:0 70px">
    <div style="flex:0 0 360px">
      <div class="heading" style="font-size:40px;line-height:1.15">Every control,<br>one click away</div>
      <div class="muted" style="font-size:19px;margin-top:14px;line-height:1.5">Pick what to blur, set rules per chat, and press <b class="accent">Alt+Shift+V</b> to cover everything at once.</div>
    </div>
    <img class="shot" src="{sized('popup.png', height=700)[0]}">
  </div>""")
screenshot("5-on-device.png", "Private by design",
           "No servers, no accounts, no tracking. Every check runs on your device, even the AI.", "options-sensitive.png")

# Fades the art in from the left so its paper meets the page with no seam.
hero = (f"background:url('file://{HERO}') no-repeat;"
        "-webkit-mask-image:linear-gradient(to right,transparent 0,#000 34%);mask-image:linear-gradient(to right,transparent 0,#000 34%);")
HERO_PAPER = "<style>body{background:#F3EAE0}</style>"  # measured from the hero art's paper
render("marquee-1400x560.png", 1400, 560, HERO_PAPER + f"""
  <div style="position:absolute;inset:0;{hero}background-size:1060px auto;background-position:right 0 top -30px"></div>
  <div style="position:absolute;left:84px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center">
    <div style="display:flex;align-items:center;gap:14px"><div class="logo" style="width:56px;height:56px">{LOGO}</div>
      <div class="heading" style="font-size:40px">Veil</div></div>
    <div class="heading" style="font-size:50px;line-height:1.08;margin-top:26px">Your chats,<br>for your eyes only.</div>
    <div class="muted" style="font-size:19px;line-height:1.5;margin-top:18px">Blurs WhatsApp Web, Telegram and Messenger until you hover, and hides codes and card numbers on its own. 100% on-device.</div>
  </div>""")
render("small-440x280.png", 440, 280, HERO_PAPER + f"""
  <div style="position:absolute;left:190px;top:0;bottom:0;right:0;{hero}background-size:640px auto;background-position:left -320px top -60px"></div>
  <div style="position:absolute;left:30px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:230px">
    <div class="logo" style="width:52px;height:52px">{LOGO}</div>
    <div class="heading" style="font-size:36px;margin-top:12px">Veil</div>
    <div style="font-size:15px;margin-top:4px;color:#404546">Smart chat privacy</div>
  </div>""")
