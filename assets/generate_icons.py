import os
from PIL import Image, ImageDraw

def create_snv_icon():
    size = (512, 512)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background rounded rectangle
    # Dark slate/emerald gradient simulation
    for y in range(512):
        t = y / 512.0
        r = int(15 * (1 - t) + 2 * t)
        g = int(23 * (1 - t) + 44 * t)
        b = int(42 * (1 - t) + 34 * t)
        draw.line([(0, y), (511, y)], fill=(r, g, b, 255))

    # Mask with rounded corners (radius 100)
    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (511, 511)], radius=100, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)
    # Border
    draw.rounded_rectangle([(3, 3), (508, 508)], radius=98, outline=(16, 185, 129, 180), width=6)

    # 2. Outer shield
    shield_pts = [
        (256, 90),
        (390, 155),
        (390, 305),
        (256, 435),
        (122, 305),
        (122, 155)
    ]
    draw.polygon(shield_pts, fill=(17, 24, 39, 230), outline=(16, 185, 129, 255))
    draw.line(shield_pts + [shield_pts[0]], fill=(6, 182, 212, 255), width=8)

    # Inner shield accent
    inner_shield = [
        (256, 120),
        (360, 175),
        (360, 290),
        (256, 400),
        (152, 290),
        (152, 175)
    ]
    draw.polygon(inner_shield, fill=(16, 185, 129, 35))

    # Neural network connections
    draw.line([(256, 170), (256, 245)], fill=(52, 211, 153, 220), width=6)
    draw.line([(240, 255), (196, 320)], fill=(6, 182, 212, 220), width=6)
    draw.line([(272, 255), (316, 320)], fill=(59, 130, 246, 220), width=6)
    draw.line([(190, 220), (240, 245)], fill=(16, 185, 129, 220), width=5)
    draw.line([(322, 220), (272, 245)], fill=(96, 165, 250, 220), width=5)

    # Core node
    draw.ellipse([(224, 215), (288, 275)], fill=(16, 185, 129, 255), outline=(255, 255, 255, 220), width=4)
    # Peripheral nodes
    draw.ellipse([(242, 156), (270, 184)], fill=(52, 211, 153, 255))
    draw.ellipse([(182, 306), (210, 334)], fill=(6, 182, 212, 255))
    draw.ellipse([(302, 306), (330, 334)], fill=(59, 130, 246, 255))
    draw.ellipse([(168, 208), (192, 232)], fill=(16, 185, 129, 255))
    draw.ellipse([(320, 208), (344, 232)], fill=(96, 165, 250, 255))

    # Privacy lock symbol at bottom
    draw.rounded_rectangle([(244, 350), (268, 374)], radius=4, fill=(16, 185, 129, 255))
    draw.arc([(247, 336), (265, 354)], start=180, end=0, fill=(16, 185, 129, 255), width=4)

    os.makedirs("assets", exist_ok=True)
    png_path = os.path.join("assets", "icon.png")
    img.save(png_path, "PNG")
    print(f"Generated {png_path}")

    # Generate multi-resolution ICO for Windows
    ico_path = os.path.join("assets", "icon.ico")
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ico_path, format="ICO", sizes=icon_sizes)
    print(f"Generated {ico_path}")

if __name__ == "__main__":
    create_snv_icon()
