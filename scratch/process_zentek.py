import re
import math

def calculate_price(cost):
    val = (cost / 0.9) + 30
    return int(round(val / 5) * 5)

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

raw_text = """
Asus Vivobook X1404V i3 1315U 6 Núcleos 256gb Ssd 12gb Ram 14” Full HD Teclado numérico en el Touchpad Ultraslim 1Kg
Uss 540

Lenovo IdeaPad 1 AMD Ryzen 5 7520U 8GB Ram 256GB SSD 15.6” Full HD Abyss Blue
Uss 590

HP 15-FD0130WM Intel Core i3-N305 8gb RAM 256gb SSD 15.6” Full HD Touchscreen Moonlight Blue
Uss 590

Asus VivoBook Go E1504FA-WS51 AMD Ryzen 5 40 512GB SSD 8GB Ram Ddr5 5600Mhz 15.6" Full HD BLACK
Uss 640

HP FC0025WM AMD Ryzen 5 7520U 8gb Ram Ddr5 5600mhz 256gb SSD 15.6" Full HD IPS touch Natural Silver
Uss 640

HP 15-FD0130WM Intel Core i3-N305 16gb RAM 512gb SSD 15.6” Full HD Touchscreen Moonlight Blue
Uss 690

Dell Latitude 5420 i7 1165G7 512gb SSD 16GB Ram 14" Full HD WIN11Pro.
Uss 740

Asus VivoBook X1404VAP-V14.C58256 Intel Core 5 120U 10 Nucleos 512gb SSD 16gb Ram 14" Full HD QUIET BLUE
Uss 740

Dell Inspiron 5440-5463BLK i5-1334U 10 Nucleos 512GB 16gb Ram Ddr5 5600Mhz 14" Full HD+ (1920x1200) CARBON BLACK Teclado Retroiluminado
Uss 790

Asus VivoBook F1504VA-WS51 i5-1334U 10 Nucleos 512GB SSD 16gb Ram 15.6” Full HD SILVER
Uss 790

Acer Aspire Go 15 AG15-51P-510U i5-1334U 10 Nucleos 512gb SSD 16gb Ram Ddr5 5600Mhz 15.3" WUXGA (1920x1200) IPS STEEL GRAY
Uss 790

HP LAPTOP 15-fc0057 AMD Ryzen 7 7730U 8 Nucleos 16GB Ram 512GB Ssd 15.6” Full HD IPS Touch SILVER
Uss 790

HP 15-FD0159 Intel Core 5 120U 10 Nucleos 512GB SSD 16GB Ram 15.6" Full HD TOUCHSCREEN SILVER
Uss 790

Dell Latitude 5420 i7 1165G7 512gb SSD 32gb Ram 14" Full HD WIN11Pro.
Uss 840

HP 255 G10 AMD Ryzen 7 7735U 512GB SSD 16GB Ram Ddr5 5600Mhz 15.6" Full HD DARK ASH SILVER
Uss 840

DELL LDC 15255 AMD RYZEN 7 7730U 8 Nucleos 16GB Ram 512GB SSD 15.6” Full HD Touch BLACK
Uss 840

HP 15-FD0159 Intel Core ultra 5 125h 14 Núcleos 512GB SSD 16Gb Ram ddr5 5600Mhz 15.6” Full HD TOUCHSCREEN SILVER.
Uss 840

Asus X1404 i7 1355U 10 Nucleos 512gb SSD 16gb Ram 14” Full HD
Uss 890

LENOVO SLIM 3 15ABR8 AMD Ryzen 7 7730 8 Núcleos 16GB Ram 1TB SSD 15.6" Full HD TOUCHSCREEN ARTIC GREY
Uss 890

ASUS VIVOBOOK X1504V Intel Core 7 150U 10 Nucleos 512GB Ssd 16GB RAM 15.6″ Full HD Teclado Español
Uss 940

Asus Vivobook F1605VA-WS74 i7 1355U 10 Nucleos 512GB SSD 16GB Ram 16" Full HD+ (1920x1200) INDIE BLACK Teclado Retroiluminado lector de huella
Uss 940

Dell Latitude 5320 i7 1185G7 512GB SSD 32GB Ram 13" Full HD 2EN1 touchscreen Teclado retroiluminado Win11pro
Uss 940

SAMSUNG GALAXY BOOK 4 Intel Core 7 150U 10 Núcleos 16GB Ram 512GB SSD 15.6” Full HD Teclado Retroiluminado Lector de huella SILVER
Uss 990

Dell Latitude 7430 I7 1265U 10 Núcleos 512gb SSD 32GB Ram 14” Full HD TOUCHSCREEN WIN11 Pro BLACK teclado Retroiluminado
Uss 1010

Dell 15 DC15250 i7-1355U 10 Nucleos 1TB SSD 16GB Ram 15.6" Full HD TOUCHSCREEN BLACK
Uss 1010

DELL LDC 15255 AMD RYZEN 7 7730U 8 Nucleos 32gb Ram 1tb SSD 15.6” Full HD Touch BLACK
Uss 1010

HP LAPTOP 15-fc0057 AMD Ryzen 7 7730U 8 Nucleos 32gb Ram Ddr5 5600Mhz 1TB Ssd 15.6” Full HD IPS Touch SILVER
Uss 1010

Asus Vivobook 16 Flip TN3604YA-CS71T Amd Ryzen 7 7730U 8 Núcleos 1TB SSD 16GB Ram 16” Full HD+ (1920×01200) 2EN1 TOUCHSCREEN BLACK Teclado Retroiluminado
Uss 1060

HP OmniBook 7 Flip Al 16-AU0008 Intel Core Ultra 5 226V 512GB SSD 16GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) 2en1 TOUCHSCREEN Teclado Retroiluminado SILVER
Uss 1110

Dell 15 DC15250 i7-1355U 10 Nucleos 1TB SSD 32gb Ram 15.6" Full HD TOUCHSCREEN BLACK
Uss 1110

HP OmniBook 7 Flip 16-AU0070 2-IN-1 Intel Core 7 265V 512gb SSD 16GB Ram Ddr5 5600Mhz 16" WUXGA (1920x1200) TOUCHSCREEN IPS GLACIER SILVER Teclado Retroiluminado
Uss 1160

HP OmniBook X Flip Al 14FK0033 2-IN-1 Ryzen 7 Al 7350 1TB SSD 24GB Ram Ddr5 7600 MHz 14" WUXGA (1920x1200) 2en1 TOUCHSCREEN METEOR SILVER Teclado Retroiluminado
Uss 1160

Dell Pro 16 Plus AMD Ryzen 7 PRO 250 512GB SSD 16GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) WIN11 Pro PLATINUM SILVER Teclado Retroiluminado
Uss 1160

lenovo thinkpad l14 gen 5 Intel core ultra 7 155U 512gb ssd 16gb Ram Ddr5 5600Mhz 14” full hd+ (1920x1200) win 11 pro teclado retroiluminado black
Uss 1160

lenovo thinkpad l14 gen 4 core i7 1365U 10 Núcleos 512gb ssd 16gb Ram Ddr5 5600Mhz 14”Full HD touchscreen ips Teclado Retroiluminado win 11 pro black
Uss 1210

Acer NITRO V 16 ANV16-42-R309 AMD Ryzen 5 240 512GB SSD 16GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) 180Hz Geforce RTX 5050 8gb Teclado Retroiluminado BLACK
Uss 1210

MSI Thin 15 B13VE-3023US i5-13420H 10 Nucleos 512GB SSD 16GB Ram 15.6" Full HD 144Hz Geforce RTX 4050 6gb Teclado Retroiluminado
Uss 1210

HP OmniBook XFlip Al 16-AS0047 Intel Core Ultra 7 256V 512GB SSD 16GB Ram Ddr5 5600Mhz 16" 3k (2880x1800) 2en1 TOUCHSCREEN OLED Teclado Retroiluminado GRAY
Uss 1210

HP 15-fd1023ca Intel Core Ultra 7 155H 16 Nucleos 32GB Ram DDR5 5600Mhz 1TB SSD 15.6” Full HD Teclado Retroiluminado
Uss 1210

MSI Thin 15 i5-13420H 512GB SSD 16GB Ram 15.6" Full HD 144Hz Geforce RTX 4060 8gb Teclado Retroiluminado GRAY
Uss 1260

HP Spectre x360 16-AA0013 Intel Core Ultra 7 155H 16 Nucleos 1TB SSD 16GB Ram Ddr5 7500Mhz 16" 3k (2880x1600) 2en1 TOUCHSCREEN Teclado Retroiluminado BLACK
Uss 1260

Lenovo YOGA 7 16IML9 Intel Core Ultra 7 155U 12 Nucleos 1TB SSD 16GB Ram Ddr5 7500Mhz 16" Full HD+ (1920x1200) 2en1 TOUCHSCREEN IPS Teclado Retroiluminado Lector de huella GREY
Uss 1260

Hp Victus 15-fb309dx Amd Ryzen 7 7445HS 8 Nucleos 512gb Ssd 16gb Ram Ddr5 5600Mhz 15.6” Full HD IPS GeForce RTX 4050 6gb teclado retroiluminado
Uss 1310

HP OmniBook XFlip 16-AR0033 Amd Ryzen AI 7 350 1TB SSD 24GB Ram Ddr5 6500Mhz 16" Full HD+ (1920x1200) 2en1 TOUCHSCREEN IPS Teclado Retroiluminado SILVER
Uss 1310

ASUS VIVOBOOK X1504V Intel Core 7 150U 10 Nucleos 1TB Ssd 40GB RAM 15.6″ Full HD Teclado Español
Uss 1310

Asus Vivobook F1605VA-WS74 i7 1355U 10 Nucleos 1TB SSD 40GB Ram 16" Full HD+ (1920x1200) INDIE BLACK Teclado Retroiluminado lector de huella
Uss 1310

Dell 14 Plus DB14250 Intel Core Ultra 7 258V 1TB SSD 32GB Ram Ddr5 5600Mhz 14" 3k (2880x1800) ICE BLUE Teclado Retroiluminado.
Uss 1310

MSI Thin 15 B13VE-3023US i5-13420H 10 Nucleos 1TB SSD 32GB Ram 15.6" Full HD 144Hz Geforce RTX 4050 6gb Teclado Retroiluminado
Uss 1410

HP OmniBook 7 17-DC0373 Intel Core Ultra 7 258V 1TB SSD 32GB Ram Ddr5 5600Mhz 17.3" Full HD TOUCHSCREEN Teclado Retroiluminado SILVER
Uss 1410

ASUS TUF A16 FA607NUG AMD Ryzen 7 7445HS 8 Nucleos 512GB SSD 16GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) 144Hz GeForce RTX 4050 6gb MECHA GRAY Teclado Retroiluminado
Uss 1410

Acer Swift GO 16 SFG16-72T-95LG intel core Ultra 9 185H 16 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 16" WUXGA (1920x1200) TOUCHSCREEN IPS IRON Teclado Retroiluminado
Uss 1410

MSI Thin 15 i5-13420H 1TB SSD 32GB Ram 15.6" Full HD 144Hz Geforce RTX 4060 8gb Teclado Retroiluminado GRAY
Uss 1460

Asus Vivobook 16 Flip TN3604YA-CS71T Amd Ryzen 7 7730U 8 Núcleos 1TB SSD 40GB Ram 16” Full HD+ (1920×01200) 2EN1 TOUCHSCREEN BLACK Teclado Retroiluminado
Uss 1460

ACER NITRO LITE NL16-71G-77VC I7-13620H 10 Núcleos 16GB Ram Ddr5 5600Mhz 512gb Ssd 16” IPS Full HD+ (1920x1200) 165Hz Geforce RTX 4050 6gb Teclado Retroiluminado
Uss 1460

Lenovo loq 15ahp10 gaming Amd ryzen 7 250 512gb ssd 16gb Ram Ddr5 5600Mhz 15.6” Full HD 144hz Geforce RTX 5050 8gb Teclado Retroiluminado gray
Uss 1520

lenovo thinkpad l14 gen 4 core i7 1365U 10 Núcleos 1TB ssd 32GB Ram Ddr5 5600Mhz 14”Full HD touchscreen ips Teclado Retroiluminado win 11 pro black
Uss 1520

lenovo thinkpad l14 gen 5 Intel core ultra 7 155U 1tb ssd 32gb Ram Ddr5 5600Mhz 14” full hd+ (1920x1200) win 11 pro teclado retroiluminado black
Uss 1520

Dell 14 Plus Intel Core Ultra 9 288V 1TB Ssd 32GB Ram Ddr5 5600Mhz 14" Full HD+ (1920x1200) 2en1 TOUCHSCREEN Teclado Retroiluminado ICE BLUE
Uss 1520

Msi katana 15 b14wek 001us  i7 14650HX 20 Núcleos 512gb ssd 16gb Ram Ddr5 5600Mhz  15.6” Full Had 144hz ips geforce rtx 5050 8gb Teclado Retroiluminado rgb black
Uss 1570

Hp Victus 15-fb309dx Amd Ryzen 7 7445HS 8 Nucleos 1TB Ssd 32gb Ram Ddr5 5600Mhz 15.6” Full HD IPS GeForce RTX 4050 6gb teclado retroiluminado
Uss 1670

ACER NITRO LITE NL16-71G-77VC I7-13620H 10 Núcleos 24GB Ram Ddr5 5600Mhz 1TB Ssd 16” IPS Full HD+ (1920x1200) 165Hz Geforce RTX 4050 6gb Teclado Retroiluminado
Uss 1670

ASUS TUF A16 FA607NUG AMD Ryzen 7 7445HS 8 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) 144Hz GeForce RTX 4050 6gb MECHA GRAY Teclado Retroiluminado
Uss 1670

Hp omnibook 7 16 ay0010ca intel core ultra 7 255H 16 Nucleos 1tb ssd 32gb Ram Ddr5 5600Mhz 16’ 2k (2048x1280) touchscreen GeForce RTX 4050 6gb Teclado Retroiluminado silver
Uss 1720

HP OmniBook 7 17-DC0073 Intel Core Ultra 7 258V 1TB SSD 32GB Ram Ddr5 5600Mhz 17.3" Full HD TOUCHSCREEN Geforce RTX 4050 6gb Teclado Retroiluminado SILVER
Uss 1720

HP Spectre x360 16-AA0023 2-IN-1 Intel Core Ultra 7 155H 1TB SSD 32GB Ram Ddr5 5600Mhz 16" 3K (2880x1800) OLED 2EN1 TOUCHSCREEN Geforce RTX 4050 6gb BLACK Teclado retroiluminado.
Uss 1720

HP OmniBook 7 Flip Al 16-AU0095 2-IN-1 Intel core Ultra 9 288V 1TB SSD 32GB Ram Ddr5 5600Mhz 16" 2.8K (2880x1800) 2en1 TOUCHSCREEN OLED SILVER Teclado Retroiluminado.
Uss 1720

Lenovo loq 15ahp10 gaming Amd ryzen 7 250 1TB ssd 32GB Ram Ddr5 5600Mhz 15.6” Full HD 144hz Geforce RTX 5050 8gb Teclado Retroiluminado gray
Uss 1920

MSI CYBORG 15 Intel Core 7 240H 10 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 15.6" Full HD 144Hz GeForce RTX 5060 8gb BLACK Teclado Retroiluminado
Uss 1920

HP Omen 16-AP0053DX AMD Ryzen 9 8940HX 16 Nucleos 32GB RAM Ddr5 5600Mhz 1TB Ssd GeForce RTX 5060 8GB 16" Full HD+ 144Hz Teclado Retroiluminado
Uss 1920

Msi katana 15 b14wek 001us  i7 14650HX 20 Núcleos 1TB ssd 32GB Ram Ddr5 5600Mhz  15.6” Full Had 144hz ips geforce rtx 5050 8gb Teclado Retroiluminado rgb black
Uss 1970

Dell alienware 16 aurora intel core ultra 7 240h 1TB Ssd 32gb Ram Ddr5 5600Mhz 16” 2.6k (2560x1600) 120hz GeForce RTX 5060 8gb basalt black Teclado Retroiluminado
Uss 2050

Asus TUF A16 FA608UP AMD Ryzen AI 9 270 1TB SSD 32GB Ram Ddr5 5600Mhz 16" Full HD+ (1920x1200) 165Hz GeForce RTX 5070 8gb JAEGAR GRAY Teclado Retroiluminado
Uss 2350

MSI CROSSHAIR 18 HX AI A2XWGKG Intel core Ultra 9 275HX 24 Núcleos 1TB SSD 32GB Ram Ddr5 5600Mhz 18" 2.5k (2560x1600) 240Hz Geforce RTX 5070 8gb COSMO GRAY SteelSeries RGB Teclado Retroiluminado
Uss 2400

Lenovo LEGION 5 15IRX10 i9-14900HX 24 Núcleos 1TB SSD 32GB Ram Ddr5 5600Mhz 15.1" 2.5K (2560x1600) OLED 165Hz GeForce RTX 5070 8gb Teclado Retroiluminado ECLIPSE BLACK
Uss 2500

Dell Alienware Aurora 16x Intel Core ultra 9 275HX 24 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 16" 2.5 (2560x1600) 240Hz Geforce RTX 5070 8gb RGB Teclado Retroiluminado
Uss 2550

Dell alienware 16 aurora intel core ultra 7 240h 1TB Ssd 64gb Ram Ddr5 5600Mhz 16” 2.6k (2560x1600) 120hz GeForce RTX 5060 8gb basalt black Teclado Retroiluminado
Uss 2600

MSI RAIDER 18 HX A14VHG-251US i9-14900HX 24 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 18" 2.5k (2560x1600) 240Hz Geforce RTX 4080 12gb  BLACK RGB Teclado Retroiluminado
Uss 2800

Lenovo LEGION 7 16IAX10H Intel Core Ultra 9 275HX 24 Nucleos 2TB SSD 32GB Ram Ddr5 5600Mhz 16" 2.5K (2560x1600) OLED 240Hz Geforce RTX 5070Ti 12gb ECLIPSE BLACK RGB Teclado Retroiluminado
Uss 2850

Asus ROG Strix G18 G815JPR-IS96 G i9-14900HX 24 Nucleos 1TB SSD 32GB Ram Ddr5 5600Mhz 18" Full HD+ (1920x1200) 144Hz Geforce RTX 5070 8gb ECLIPSE GRAY RGB Teclado Retroiluminado
Uss 2900

MSI CROSSHAIR 18 HX AI A2XWGKG Intel core Ultra 9 275HX 24 Núcleos 1TB SSD 64GB Ram Ddr5 5600Mhz 18" 2.5k (2560x1600) 240Hz Geforce RTX 5070 8gb COSMO GRAY SteelSeries RGB Teclado Retroiluminado
Uss 3000

Dell Alienware Aurora 16x Intel Core ultra 9 275HX 24 Nucleos 2TB SSD 64GB Ram Ddr5 5600Mhz 16" 2.5 (2560x1600) 240Hz Geforce RTX 5070 8gb RGB Teclado Retroiluminado
Uss 3150

Lenovo LEGION 7 16IAX10H Intel Core Ultra 9 275HX 24 Nucleos 2TB SSD 64GB Ram Ddr5 5600Mhz 16" 2.5K (2560x1600) OLED 240Hz Geforce RTX 5070Ti 12gb ECLIPSE BLACK RGB Teclado Retroiluminado
Uss 3350

Lenovo LEGION 7 16IAX10H Intel Core Ultra 9 275HX 24 Nucleos 1TB SSD 32gb Ram Ddr5 5800Mhz 16" 2.5k (2560x 1600) OLED 240Hz GeForce RTX 5080 16gb ECLIPSE BLACK RGB Teclado Retroiluminado.
Uss 3500

Lenovo LEGION 9 18IAX10 Intel Core Ultra 9 275HX 24 Nucleos 1TB Ssd 32GB Ram Ddr5 5600Mhz 18" 4k (3840x2400) 240Hz ECLIPSE BLACK Geforce RTX 5080 16Gb RGB Teclado Retroiluminado .
Uss 3700

Lenovo LEGION 7 16IAX10H Intel Core Ultra 9 275HX 24 Nucleos 2TB SSD 64gb Ram Ddr5 5800Mhz 16" 2.5k (2560x 1600) OLED 240Hz GeForce RTX 5080 16gb ECLIPSE BLACK RGB Teclado Retroiluminado.
Uss 4000

Lenovo LEGION 9 18IAX10 Intel Core Ultra 9 275HX 24 Nucleos 2TB Ssd 64GB Ram Ddr5 5600Mhz 18" 4k (3840x2400) 240Hz ECLIPSE BLACK Geforce RTX 5080 16Gb RGB Teclado Retroiluminado
Uss 4300

Asus ROG STRIX G18 Intel Core Ultra 9 275HX 24 Núcleos 2TB SSD 64GB Ram Ddr5 5600Mhz 18" 2.5K (2560x1600) 240Hz GeForce RTX 5080 16gb ECLIPSE GRAY Teclado Retroiluminado
Uss 4400

Acer Predator Helios 18 Intel Core Ultra 9 275HX 24 Nucleos 64gb Ram Ddr5 5600Mhz 2TB Ssd 18” UHD+ 4K (3840 x 2400) 120Hz GeForce RTX 5090 24gb Teclado Retroiluminado
Uss 4800

MSI RAIDER 18 HX AI A2XWJG-452 Intel Core Ultra 9 285HX 24 Núcleos 2TB SSD 64GB RAM Ddr5 5600Mhz 18" 2.5K (2560x1600) 240Hz GeForce RTX 5090 24gb CORE BLACK RGB Teclado Retroiluminado
Uss 4900

Lenovo LEGION 9 18IAX10 Intel Core Ultra 9 275HX 24 Nucleos 2TB 64GB Ram Ddr5 5600Mhz 18" 4K (3840x2400) 240Hz BLACK GeForce RTX 5090 24gb RGB Teclado Retroiluminado
Uss 5000

Dell Alienware 18 Area-51 Intel Core Ultra 9 275HX 24 Nucleos 64GB RAM Ddr5 5600Mhz 2TB Ssd 18” 2.5k (2560x1600) 300Hz GeForce RTX 5090 24GB Teclado Retroiluminado
Uss 5300

ASUS ROG Strix SCAR 18 Intel Core Ultra 9 275HX 24 Núcleos 2TB SSD 64GB Ram Ddr5 5600Mhz 18” 2.5k (2560x1600) 240Hz WIN11 Pro Geforce RTX 5090 24GB OFF BLACK Teclado retroiluminado
Uss 5300
"""

lines = raw_text.strip().split('\n')
products = []
current_name = None

for line in lines:
    line = line.strip()
    if not line: continue
    if line.startswith('Uss '):
        if current_name:
            price = int(line.replace('Uss ', ''))
            products.append((current_name, price))
            current_name = None
    else:
        current_name = line

# Known brands
brands = ['Asus', 'Lenovo', 'HP', 'Dell', 'Acer', 'MSI', 'SAMSUNG']

sql = []
sql.append("-- =============================================================")
sql.append("-- SEED: Productos Zentek (Notebooks) → RAM Informática")
sql.append(f"-- Total: {len(products)} productos")
sql.append("-- =============================================================")
sql.append("")
sql.append("INSERT INTO categories (name, slug) VALUES ('Notebooks & Macbooks', 'notebooks') ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;")
sql.append("")
sql.append("-- 2. Asegurar Marcas")
sql.append("INSERT INTO brands (name, slug) VALUES ")
sql.append("  ('Apple', 'apple'), ('Samsung', 'samsung'), ('Lenovo', 'lenovo'), ")
sql.append("  ('HP', 'hp'), ('Dell', 'dell'), ('Acer', 'acer'), ('Asus', 'asus'), ")
sql.append("  ('MSI', 'msi'), ('Acer', 'acer') ON CONFLICT (slug) DO NOTHING;")
sql.append("")
sql.append("CREATE OR REPLACE FUNCTION _zentek_insert(p_name text, p_slug text, p_cat_slug text, p_brand_slug text, p_price_usd numeric) RETURNS void AS $$")
sql.append("DECLARE v_cat_id uuid; v_brand_id uuid; v_prod_id uuid; v_var_id uuid;")
sql.append("BEGIN")
sql.append("  SELECT id INTO v_cat_id FROM categories WHERE slug = p_cat_slug;")
sql.append("  SELECT id INTO v_brand_id FROM brands WHERE slug = p_brand_slug;")
sql.append("  INSERT INTO products (name, slug, category_id, brand_id, condition, active) VALUES (p_name, p_slug, v_cat_id, v_brand_id, 'new', true) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now() RETURNING id INTO v_prod_id;")
sql.append("  INSERT INTO product_variants (product_id, sku, active) VALUES (v_prod_id, p_slug || '-v1', true) ON CONFLICT (sku) DO NOTHING RETURNING id INTO v_var_id;")
sql.append("  IF v_var_id IS NULL THEN SELECT id INTO v_var_id FROM product_variants WHERE sku = p_slug || '-v1'; END IF;")
sql.append("  INSERT INTO prices (variant_id, currency, amount) VALUES (v_var_id, 'USD', p_price_usd) ON CONFLICT (variant_id, currency) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();")
sql.append("END; $$ LANGUAGE plpgsql;")
sql.append("")

for name, cost in products:
    # Find brand
    brand_slug = 'generic'
    for b in brands:
        if name.lower().startswith(b.lower()):
            brand_slug = b.lower()
            break
    
    # Calculate price
    final_price = calculate_price(cost)
    
    # Clean name (remove redundant brand if it repeats, etc.)
    # But user wants a descriptive name.
    # The user's input name is already descriptive.
    # Just ensure we don't have weird characters for the slug.
    
    slug = slugify(name)
    # Escape single quotes for SQL
    safe_name = name.replace("'", "''")
    
    sql.append(f"SELECT _zentek_insert('{safe_name}', '{slug}', 'notebooks', '{brand_slug}', {final_price});")

sql.append("")
sql.append("DROP FUNCTION IF EXISTS _zentek_insert(text, text, text, text, numeric);")

with open('/Users/ramirotule/Documents/1.Proyectos/Personales/raminformatica/supabase/seed_zentek_notebooks.sql', 'w') as f:
    f.write('\n'.join(sql))
