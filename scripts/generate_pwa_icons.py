import os
from PIL import Image

def generate_icons():
    src_path = "img/escudo.png"
    if not os.path.exists(src_path):
        print(f"Error: {src_path} no existe")
        return

    # Create target directories
    for dir_path in ["img/icons", "docs/img/icons"]:
        os.makedirs(dir_path, exist_ok=True)

    img = Image.open(src_path).convert("RGBA")
    print(f"Imagen original cargada: {img.size}, modo: {img.mode}")

    # Color de fondo del club (Design token --bg: #151824)
    BG_COLOR = (21, 24, 36, 255)

    # 1. icon-192.png (192x192 transparente)
    icon_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    for out_dir in ["img/icons", "docs/img/icons"]:
        icon_192.save(os.path.join(out_dir, "icon-192.png"), "PNG", optimize=True)
    print("[OK] Generado icon-192.png")

    # 2. icon-512.png (512x512 transparente)
    icon_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    for out_dir in ["img/icons", "docs/img/icons"]:
        icon_512.save(os.path.join(out_dir, "icon-512.png"), "PNG", optimize=True)
    print("[OK] Generado icon-512.png")

    # 3. icon-maskable-512.png (512x512 con zona de seguridad para Android Adaptive Icons)
    # Android aplica una máscara circular de ~410px de diámetro en un lienzo de 512x512 (80% safe zone).
    # Colocamos el escudo centrado en un área de ~370x370 con fondo del club.
    maskable = Image.new("RGBA", (512, 512), BG_COLOR)
    shield_inner_size = 370
    shield_inner = img.resize((shield_inner_size, shield_inner_size), Image.Resampling.LANCZOS)
    offset = (512 - shield_inner_size) // 2
    maskable.paste(shield_inner, (offset, offset), shield_inner)
    for out_dir in ["img/icons", "docs/img/icons"]:
        maskable.save(os.path.join(out_dir, "icon-maskable-512.png"), "PNG", optimize=True)
    print("[OK] Generado icon-maskable-512.png")

    # 4. apple-touch-icon.png (180x180 para iOS Home Screen, con fondo sólido para evitar fondo negro de Safari)
    apple_icon = Image.new("RGBA", (180, 180), BG_COLOR)
    apple_shield_size = 144
    apple_shield = img.resize((apple_shield_size, apple_shield_size), Image.Resampling.LANCZOS)
    apple_offset = (180 - apple_shield_size) // 2
    apple_icon.paste(apple_shield, (apple_offset, apple_offset), apple_shield)
    # Convertir a RGB ya que Apple no admite transparencias en touch-icon
    apple_icon_rgb = apple_icon.convert("RGB")
    for out_dir in ["img/icons", "docs/img/icons"]:
        apple_icon_rgb.save(os.path.join(out_dir, "apple-touch-icon.png"), "PNG", optimize=True)
    print("[OK] Generado apple-touch-icon.png")

    print("\nTodos los iconos PWA fueron generados exitosamente en img/icons/ y docs/img/icons/!")

if __name__ == "__main__":
    generate_icons()
