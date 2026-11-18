#!/usr/bin/env python3
"""Média katalogu Connectu (obálky 2:3, bannery, ikony, galerie) z existujících obrázků webu, hry a enginu.
Zdroje se jen čtou. Výstup: <výstup>/<produkt>/{cover,hero,icon,shot-N}.webp
Obálky jsou bez textu (jméno produktu přidává aplikace z katalogu – přejmenování nevyžaduje nový obrázek).

  python3 tools/make-media.py <cesta k Voxar.app> <cesta k Voxario-Studio-Engine> <výstup>
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

WEB, ENG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ER = os.path.join(WEB, "game/voxario/Eryndor/docs/screenshots")


def P(*a):
    return os.path.join(WEB, *a)


def load(p):
    return Image.open(p).convert("RGB")


def crop(im, w, h, fx=0.5, fy=0.5):
    """Výřez s poměrem w:h kolem bodu (fx, fy) a změna velikosti."""
    r = w / h
    W, H = im.size
    if W / H > r:
        cw, ch = int(H * r), H
    else:
        cw, ch = W, int(W / r)
    x = int(min(max(fx * W - cw / 2, 0), W - cw))
    y = int(min(max(fy * H - ch / 2, 0), H - ch))
    return im.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def shade(im, top=0.0, bottom=0.75, color=(5, 7, 11)):
    """Přechod do tmavé (dole), aby byl čitelný text, který kreslí aplikace."""
    w, h = im.size
    g = Image.new("L", (1, h))
    for y in range(h):
        t = y / (h - 1)
        a = top * (1 - t) + bottom * max(0.0, (t - 0.45) / 0.55) ** 1.4
        g.putpixel((0, y), int(255 * min(1, a)))
    return Image.composite(Image.new("RGB", (w, h), color), im, g.resize((w, h)))


def overlay(base, logo, box, glow=None):
    lg = Image.open(logo).convert("RGBA")
    lg.thumbnail(box[2:], Image.LANCZOS)
    x = box[0] + (box[2] - lg.width) // 2
    y = box[1] + (box[3] - lg.height) // 2
    out = base.convert("RGBA")
    if glow:
        g = Image.new("RGBA", out.size, (0, 0, 0, 0))
        a = lg.split()[3].filter(ImageFilter.GaussianBlur(18))
        g.paste(Image.new("RGBA", lg.size, glow + (255,)), (x, y), a)
        out = Image.alpha_composite(out, g)
    out.alpha_composite(lg, (x, y))
    return out.convert("RGB")


def icon_from(logo, bg=(10, 14, 22), size=256, pad=0.14):
    im = Image.new("RGBA", (size, size), bg + (255,))
    lg = Image.open(logo).convert("RGBA")
    m = int(size * (1 - 2 * pad))
    lg.thumbnail((m, m), Image.LANCZOS)
    im.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2))
    return im


def save(pid, name, im, q=84):
    d = os.path.join(OUT, pid)
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, name + ".webp"), "WEBP", quality=q, method=6)


def product(pid, cover, hero, icon, shots, cover_logo=None, glow=None):
    c = shade(cover, 0.0, 0.85)
    if cover_logo:
        c = overlay(c, cover_logo, (60, 120, 480, 330), glow)
    save(pid, "cover", c)
    save(pid, "hero", shade(hero, 0.15, 0.6))
    save(pid, "icon", icon.convert("RGB"), 90)
    for i, s in enumerate(shots, 1):
        save(pid, f"shot-{i}", crop(s, 1600, 900), 82)


logo = P("docs/brand/voxar-logo-transparent.png")

# Ashes of Eryon – temný fantasy svět (art webu), logo hry
shore, card = load(P("public/game/eryon/shore.webp")), load(P("public/game/ashes-card-bg.webp"))
product("ashes-of-eryon", crop(card, 600, 900, 0.62, 0.5), crop(shore, 1920, 720, 0.5, 0.45),
        icon_from(P("public/game/ashes-logo.webp"), (12, 8, 6), pad=0.04),
        [load(P("public/web/shot-ashes.webp")), shore, card], cover_logo=P("public/game/ashes-logo.webp"))

# Fantasy (pracovní název) – Eryndor / Aethelgard: snímky ze hry
val = load(os.path.join(ER, "valorie-harbor/prubeh-2-zapad-slunce.jpg"))
isl = load(os.path.join(ER, "valorie-harbor/prubeh-2-ostrov-z-vysky.jpg"))
product("fantasy", crop(val, 600, 900, 0.43, 0.5), crop(isl, 1920, 720, 0.5, 0.55), crop(val, 256, 256, 0.45, 0.55),
        [val, load(os.path.join(ER, "valorie-harbor/v1-brana-z-mostu.jpg")), load(os.path.join(ER, "mesto/m2-namesti.jpg")),
         load(os.path.join(ER, "krajina-aaa/k8-kralovska-cesta.jpg")), load(os.path.join(ER, "postavy/npc-sestava.jpg")),
         load(os.path.join(ER, "lava/t12-lava-sopka.jpg"))])

# Voxario Studio Engine – editor a hry z enginu
ed = load(os.path.join(ENG, "docs/screenshots/1.20/editor-skriptu.jpg"))
product("voxario-studio-engine",
        overlay(crop(isl, 600, 900, 0.62, 0.5), logo, (150, 180, 300, 300), (63, 224, 255)),
        crop(load(os.path.join(ER, "mesto/m2-namesti.jpg")), 1920, 720, 0.5, 0.5), icon_from(logo),
        [ed, load(os.path.join(ER, "valorie-harbor/v13-letajici-ostrov.jpg")),
         load(os.path.join(ENG, "docs/screenshots/1.20/film-4-ranni-mlha.jpg")), load(os.path.join(ER, "teren/t6-lava.jpg"))])

# Voxar.app – komunikace
portal = load(P("electron/assets/browser-portal.webp"))
product("voxar-app", overlay(crop(portal, 600, 900, 0.72, 0.5), logo, (150, 200, 300, 300), (164, 90, 255)),
        crop(load(P("public/web/holo-world.webp")), 1920, 720, 0.5, 0.5), icon_from(P("public/icon-512.png"), pad=0.0),
        [load(P("public/web/shot-community.webp"))])

# VoxarioBrowser – prohlížeč
world = load(P("electron/assets/browser-world.webp"))
product("voxario-browser", overlay(crop(world, 600, 900, 0.62, 0.5), logo, (150, 200, 300, 300), (63, 140, 255)),
        crop(world, 1920, 720, 0.5, 0.5), icon_from(logo, (8, 14, 30)), [load(P("public/web/shot-browser.webp"))])

# VoxarioProtect – bezpečnost (štít nad portálem)
base = crop(load(P("public/web/holo-portal.webp")), 600, 900, 0.5, 0.5)
d = ImageDraw.Draw(base, "RGBA")
cx, cy, s = 300, 330, 120
d.polygon([(cx, cy - s), (cx + s * 0.85, cy - s * 0.6), (cx + s * 0.75, cy + s * 0.35), (cx, cy + s),
           (cx - s * 0.75, cy + s * 0.35), (cx - s * 0.85, cy - s * 0.6)], fill=(10, 30, 40, 200), outline=(63, 224, 255, 255), width=6)
d.line([(cx - 45, cy), (cx - 10, cy + 38), (cx + 55, cy - 40)], fill=(63, 224, 255, 255), width=12)
ic = Image.new("RGB", (256, 256), (6, 18, 26))
di = ImageDraw.Draw(ic)
di.polygon([(128, 30), (210, 66), (200, 158), (128, 226), (56, 158), (46, 66)], fill=(12, 40, 52), outline=(63, 224, 255), width=8)
di.line([(92, 130), (120, 162), (172, 100)], fill=(63, 224, 255), width=14)
product("voxario-protect", base, crop(load(P("public/web/holo-portal.webp")), 1920, 720), ic,
        [load(P("public/web/shot-community.webp"))])
print("média:", sorted(os.listdir(OUT)))
