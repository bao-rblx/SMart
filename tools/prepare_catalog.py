"""Build the reviewed Vietnamese demo catalog and offline, attributed photo assets.

Run after find_product_photos.py. Prices and stock are educational examples,
not prices supplied by Open Food Facts or Wikimedia Commons.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import html
import io
import json
import re
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import threading
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
RESEARCH=ROOT/'artifacts/research'
ASSETS=ROOT/'SmartMart.App/Assets/Products'
ASSETS.mkdir(parents=True,exist_ok=True)
off={p['code']:p for p in json.loads((RESEARCH/'off.json').read_text(encoding='utf-8'))['products']}

# Names and pack sizes were checked against the source entries/packaging.
PACKAGED=[
 ('8934563138165','Mì Hảo Hảo tôm chua cay 75 g','Grocery',4500),
 ('8935217400058','Sữa TH không đường · lốc 4 × 180 ml','Dairy',36000),
 ('8934804025766','Sữa lúa mạch Milo 180 ml','Dairy',8500),
 ('8934673900928','Phô mai Vinamilk 120 g','Dairy',35000),
 ('8934673576390','Sữa tươi Vinamilk 1 lít','Dairy',37000),
 ('8934673100458','Sữa Vinamilk Green Farm 180 ml','Dairy',9500),
 ('8935217464548','Sữa hạt TH true NUT 180 ml','Dairy',13000),
 ('8854761951383','Sữa hạnh nhân 137 Degrees 1 lít','Dairy',115000),
 ('8934673101097','Sữa Vinamilk không đường','Dairy',8500),
 ('8934673701778','Sữa thực vật Vinamilk giàu đạm','Dairy',14000),
 ('8935049501503','Coca-Cola 320 ml','Beverages',10000),
 ('8935049501718','Sprite 320 ml','Beverages',10000),
 ('8934588183133','Revive chanh muối 390 ml','Beverages',12000),
 ('8934588843051','Nước điện giải Revive','Beverages',12000),
 ('19345888','Trà ô long Tea+','Beverages',11000),
 ('8935005801036','Nước khoáng La Vie 350 ml','Beverages',5000),
 ('8934588063176','Nước Aquafina 5 lít','Beverages',28000),
 ('8936127790017','Nước TH true WATER 500 ml','Beverages',6000),
 ('8936193070075','Nước tăng lực Number One','Beverages',11000),
 ('8934588452116','Sting việt quất 320 ml','Beverages',11000),
 ('8935049501596','Soda Schweppes 320 ml','Beverages',10000),
 ('8938507849094','Nước dừa xiêm xanh Cocoxim','Beverages',35000),
 ('8934588132117','Mirinda xá xị 320 ml','Beverages',10000),
 ('8935049500155','Coca-Cola không đường 600 ml','Beverages',13000),
 ('4897036692257','Monster không đường 355 ml','Beverages',32000),
 ('8934804027333','Trà chanh Nestea 196 g','Beverages',35000),
 ('8934679840327','Mì Gấu Đỏ vị gà sợi phở','Grocery',4000),
 ('8936048470036','Mì 3 Miền chay lá đa','Grocery',4000),
 ('8934637011523','Tương ớt Cholimex 270 g','Grocery',15000),
 ('8936136161143','Tương ớt CHIN-SU','Grocery',18000),
 ('8934637212531','Tương cà Cholimex','Grocery',16000),
 ('8936136163017','Nước tương CHIN-SU','Grocery',16000),
 ('8936134361040','Nước tương Nam Dương','Grocery',14000),
 ('8934988020021','Dầu đậu nành Simply','Grocery',58000),
 ('8935118306428','Bơ đậu phộng Golden Farm hạt giòn','Grocery',45000),
 ('8935118306114','Bơ đậu phộng Golden Farm mịn','Grocery',45000),
 ('8993175532457','Bánh xốp Nabati phô mai 16 g','Snacks',3500),
 ('8936036026375','Bánh Custas Tiramisu','Snacks',58000),
 ('8996001303078','Bánh quy bơ Danisa 681 g','Snacks',185000),
 ('8934760122226','Lương khô hạt Daisy 80 g','Snacks',12000),
]
FRESH=[
 ('banana','Chuối · 1 kg',25000),('orange','Cam · 1 kg',35000),
 ('tomato','Cà chua · 500 g',18000),('cucumber','Dưa leo · 500 g',15000),
 ('carrot','Cà rốt · 500 g',18000),('potato','Khoai tây · 1 kg',32000),
 ('onion','Hành tím · 500 g',22000),('broccoli','Bông cải xanh · 500 g',30000),
 ('lettuce','Xà lách · 300 g',18000),('lemon','Chanh vàng · 500 g',35000),
 ('dragonfruit','Thanh long · 1 kg',30000),('avocado','Bơ · 1 kg',55000)
]
HOME=[
 ('toothbrush','Bàn chải đánh răng','PersonalCare',25000,'general'),
 ('toothpaste','Kem đánh răng','PersonalCare',38000,'general'),
 ('shampoo','Dầu gội đầu','PersonalCare',85000,'general'),
 ('dishsoap','Nước rửa chén','Household',32000,'general'),
 ('sponge','Miếng rửa chén','Household',12000,'general'),
 ('batteries','Pin AA · vỉ 2 viên','Electronics',25000,'general'),
 ('mouse','Chuột không dây','Electronics',159000,'electronic'),
 ('cable','Cáp sạc USB-C','Electronics',69000,'electronic')
]
catalog=[]
for code,name,category,price in PACKAGED:
 catalog.append(dict(Id=1001+len(catalog),Key='off-'+code,Name=name,Category=category,Price=price,Stock=24+len(catalog)%5*12,Kind='perishable' if category=='Dairy' else 'general',Barcode=code,ShelfLifeDays=21 if category=='Dairy' else 90))
for key,name,price in FRESH:
 catalog.append(dict(Id=1001+len(catalog),Key=key,Name=name,Category='Produce',Price=price,Stock=18+len(catalog)%4*6,Kind='perishable',ShelfLifeDays=10))
for key,name,category,price,kind in HOME:
 catalog.append(dict(Id=1001+len(catalog),Key=key,Name=name,Category=category,Price=price,Stock=15+len(catalog)%4*5,Kind=kind))
(ROOT/'SmartMart.Core/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Each index refers to a reviewed result in the cached Commons search response.
SELECTION={'apple':0,'salad':0,'scanner':0,'charger':2,'towels':1,'bag':0,'coffee':0,'crackers':0,'soap':1,
           'banana':0,'orange':2,'tomato':0,'cucumber':1,'carrot':0,'potato':0,'onion':0,
           'toothbrush':0,'shampoo':1,'dishsoap':1,'sponge':1,'batteries':0,'lemon':1}
def source(key):
 if key.startswith('off-'):
  p=off[key[4:]]
  return dict(Url=p['image_front_url'],Page='https://world.openfoodfacts.org/product/'+p['code'],Title=p.get('product_name_vi') or p.get('product_name') or p['code'],Author='Open Food Facts contributors (individual credits on product page)',License='CC BY-SA 3.0',LicenseUrl='https://creativecommons.org/licenses/by-sa/3.0/')
 data=json.loads((RESEARCH/(key+'.json')).read_text(encoding='utf-8'))
 p=sorted(data['query']['pages'].values(),key=lambda p:p.get('index',0))[SELECTION.get(key,0)]
 info=p['imageinfo'][0];meta=info['extmetadata']
 def field(name):return html.unescape(re.sub('<[^>]+>','',meta.get(name,{}).get('value',''))).strip()
 return dict(Url=info.get('thumburl',info['url']).split('?')[0],OriginalUrl=info['url'],Page=info['descriptionurl'],Title=p['title'],Author=field('Artist') or field('Credit') or 'See source file page',License=field('LicenseShortName'),LicenseUrl=field('LicenseUrl'))

original={1:'off-8934673576390',2:'salad',3:'scanner',4:'charger',5:'towels',6:'bag',7:'coffee',8:'apple',9:'yogurt',10:'crackers',11:'soap',12:'off-8935005800015'}
jobs=[(x['Key'],x['Key']) for x in catalog]+[(f'original-{i:02}',key) for i,key in original.items()]
previous_sources={x['Key']:x for x in json.loads((ASSETS/'sources.json').read_text(encoding='utf-8'))} if (ASSETS/'sources.json').exists() else {}
local=threading.local()
def client():
 if not hasattr(local,'session'):
  local.session=requests.Session()
  local.session.headers.update({'User-Agent':'SmartMartCatalog/1.0 (educational demo)'})
  local.session.mount('https://',HTTPAdapter(max_retries=Retry(total=2,connect=2,backoff_factor=1)))
 return local.session
def download(job):
 key,source_key=job
 try:
  meta=source(source_key);dest=ASSETS/(key+'.jpg')
  if not dest.exists() or previous_sources.get(key,{}).get('Url') != meta['Url']:
   for attempt in range(3):
    response=client().get(meta['Url'],timeout=(12,25))
    if response.status_code==429:
     time.sleep(min(60,int(response.headers.get('Retry-After','15'))+1));continue
    response.raise_for_status();break
   image=ImageOps.exif_transpose(Image.open(io.BytesIO(response.content))).convert('RGB')
   image.thumbnail((440,360),Image.Resampling.LANCZOS)
   image.save(dest,'JPEG',quality=90,optimize=True)
  meta.update(Key=key,File=key+'.jpg',Sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),Changes='Resized to fit 440 x 360; converted to JPEG. No content edits.',Retrieved='2026-11-02')
  print('OK',key,flush=True);return meta
 except Exception as error:
  print('FAILED',key,str(error).encode('ascii','backslashreplace').decode(),flush=True);return None
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(download,jobs))
 good=[r for r in results if r]
 if len(good)!=len(jobs):
  raise SystemExit(f'Incomplete catalog: {len(good)}/{len(jobs)} images. Existing credits were preserved; retry to finish.')
 (ASSETS/'sources.json').write_text(json.dumps(good,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 lines=['NGUỒN ẢNH SẢN PHẨM — SMARTMART','Ảnh minh họa; giá và tồn kho là dữ liệu mẫu.','Ảnh được thu nhỏ và chuyển sang JPEG. Tác giả không bảo trợ ứng dụng.','Ảnh chỉnh kích thước giữ giấy phép tương ứng của bản gốc.','Dữ liệu sản phẩm Open Food Facts: ODbL / Database Contents License.','https://world.openfoodfacts.org/terms-of-use','']
 for item in good:
  lines.extend([item['Key']+' — '+item['Title'],item['Author'],item['Page'],item['License']+' — '+item['LicenseUrl'],''])
 (ASSETS/'credits.txt').write_text('\n'.join(lines),encoding='utf-8')
 print(f'Prepared {len(catalog)+12} products; {len(good)}/{len(jobs)} images.',flush=True)
