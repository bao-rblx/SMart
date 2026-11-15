"""Resolve image metadata through the public Wikimedia Commons API, respecting rate limits."""
import json
import time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
QUERIES = {
    'banana':'intitle:Banana fruit', 'orange':'intitle:Orange fruit',
    'tomato':'intitle:Tomato', 'cucumber':'intitle:Cucumber',
    'carrot':'intitle:Carrots', 'potato':'intitle:Potato',
    'onion':'intitle:Red onion', 'broccoli':'intitle:Broccoli',
    'lettuce':'intitle:Iceberg lettuce', 'lemon':'intitle:Lemon',
    'dragonfruit':'intitle:Pitaya fruit', 'avocado':'intitle:Avocado',
    'toothbrush':'intitle:Toothbrush', 'toothpaste':'intitle:Toothpaste tube',
    'shampoo':'intitle:Shampoo bottle', 'dishsoap':'intitle:Dishwashing liquid',
    'sponge':'intitle:Kitchen sponge', 'batteries':'intitle:AA batteries',
    'mouse':'intitle:Wireless mouse', 'cable':'intitle:USB-C cable',
    'yogurt':'intitle:Greek yogurt'
}

for key, query in QUERIES.items():
    dest = ROOT / 'artifacts/research' / (key + '.json')
    if dest.exists() and key != 'yogurt':
        continue
    for attempt in range(3):
        response = requests.get('https://commons.wikimedia.org/w/api.php', params={
            'action':'query', 'generator':'search', 'gsrsearch':query,
            'gsrnamespace':6, 'gsrlimit':3, 'prop':'imageinfo',
            'iiprop':'url|extmetadata', 'iiurlwidth':500, 'format':'json'
        }, headers={'User-Agent':'SmartMartCatalog/1.0 (educational retail demo)'}, timeout=30)
        if response.status_code == 429:
            time.sleep(min(60, int(response.headers.get('Retry-After','30')) + 1))
            continue
        if response.ok:
            data=response.json()
            dest.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
            print(key, json.dumps([p['title'] for p in sorted(data.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',0))],ensure_ascii=True),flush=True)
        else:
            print(key,response.status_code,flush=True)
        break
    time.sleep(8)
