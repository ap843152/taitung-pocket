"""Public-source coordinate research. No API keys; no app mutations."""
import concurrent.futures, html, json, re, urllib.request

TARGETS = {
    '野室': ['https://wgcafe.tw/','https://maps.google.com/maps?q=野室珈琲+台東市浙江路350號&output=embed'],
    '柴米': ['https://maps.google.com/maps?q=柴米DailyKitchen+台東市正氣路406號&output=embed'],
    '目目': ['https://goo.gl/maps/p9eNxuJ6mrJVUgwEA'],
    '青蔦': ['https://goo.gl/maps/LnWeB5NCTojB2Aoc7'],
    '草民': ['https://maps.app.goo.gl/SmHtiRmKZeMPqwD46'],
    '飴屋': ['https://goo.gl/maps/2QHygdPfpskaFvHP7'],
    '傻啦': ['https://maps.google.com/maps?q=傻啦慢食旅+台東市泰安街41號&output=embed'],
    '翠安儂': ['https://maps.google.com/maps?q=翠安儂風旅&t=m&z=14&output=embed&iwloc=near'],
    '大酥': ['https://maps.google.com/maps?q=大酥老公+台東市更生路713號&output=embed'],
    '有時散步': ['https://maps.google.com/maps?q=有時散步+台東市南京路113號&output=embed'],
    '蔬念': ['https://slowfoodtaitung.tw/restaurant/蔬念vegine','https://maps.google.com/maps?q=蔬念+台東市正氣路312巷12號&output=embed'],
    '艾蘭哥爾': ['https://maps.google.com/maps?q=艾蘭哥爾藝文咖啡館+台東市浙江路350號&output=embed'],
    '阿力海': ['https://maps.google.com/maps?q=阿力海百匯自助餐+台東市正氣路316號&output=embed'],
}

def fetch(url):
    from urllib.parse import quote, urlsplit, urlunsplit
    p = urlsplit(url)
    url = urlunsplit((p.scheme, p.netloc, quote(p.path, safe='/%'), quote(p.query, safe='=&%'), p.fragment))
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; TaitungPocketResearch/1.0)'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.url, r.read(3000000).decode('utf-8', errors='replace')

def inspect(name, urls):
    result = {'name': name, 'sources': []}
    for url in urls:
        item = {'url': url}
        try:
            final, body = fetch(url)
            item['final'] = final
            text = html.unescape(final + '\n' + body)
            pairs = re.findall(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', text)
            pairs += re.findall(r'!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)', text)
            item['coordinate_pairs'] = list(dict.fromkeys(pairs))[:20]
            item['map_links'] = list(dict.fromkeys(re.findall(r'(?:href|src)=["\'](https?[^"\']*(?:maps|goo\.gl|g\.co)[^"\']*)', body)))[:15]
            item['map_centers'] = list(dict.fromkeys(re.findall(r'@(-?\d+\.\d+),(-?\d+\.\d+)', text)))[:10]
            item['plain_coordinate_pairs'] = list(dict.fromkeys(re.findall(r'(22\.7\d+),\s*(121\.\d+)', text)))[:10]
            item['title'] = re.findall(r'<title>(.*?)</title>', body, re.S)[:1]
            item['map_links'] = [u for u in item['map_links'] if not re.search(r'key=|token=|signature=',u,re.I)]
        except Exception as e:
            item['error'] = str(e)
        result['sources'].append(item)
    return result

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(lambda x: inspect(*x), TARGETS.items()):
            print(json.dumps(result, ensure_ascii=True))
