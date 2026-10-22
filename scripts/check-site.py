from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import json,re,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[1];S=R/'site';base='https://aotefan.github.io/openpdf-studio/'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.title='';self.in_title=False;self.meta={};self.links=[];self.canonical=[];self.schemas=[];self.schema=False;self.json='';self.lang=None;self.badimages=0
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='html':self.lang=a.get('lang')
  if t=='h1':self.h1+=1
  if t=='title':self.in_title=True
  if t=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content')
  if t=='link' and a.get('rel')=='canonical':self.canonical.append(a['href'])
  if t=='script' and a.get('type')=='application/ld+json':self.schema=True;self.json=''
  if t=='img' and not a.get('alt'):self.badimages+=1
  for k in ('href','src'):
   if a.get(k):self.links.append(a[k])
 def handle_endtag(self,t):
  if t=='title':self.in_title=False
  if t=='script' and self.schema:self.schemas.append(json.loads(self.json));self.schema=False
 def handle_data(self,d):
  if self.in_title:self.title+=d
  if self.schema:self.json+=d
pages=[]
for f in S.rglob('*.html'):
 p=Page();p.feed(f.read_text());relative=str(f.relative_to(S)).replace('index.html','')
 assert p.h1==1 and p.title and p.lang
 assert p.canonical==[base+relative]
 assert p.meta.get('description') and p.meta.get('og:image') and p.meta.get('robots','').startswith('index')
 assert p.schemas and p.badimages==0
 for link in p.links:
  if link.startswith(base):
   local=S/unquote(urlparse(link).path.removeprefix('/openpdf-studio/'))
   if local.is_dir():local=local/'index.html'
   assert local.exists(),(f,link)
 pages.append({'path':relative or '/','title':p.title,'h1':p.h1,'schema':p.schemas[0]['@type']})
ET.parse(S/'sitemap.xml')
assert len(pages)==4
for f in [R/'README.md',R/'README.en.md',R/'CONTRIBUTING.md',R/'SECURITY.md',R/'docs/faq.md',R/'research/wps-pdf-reverse-engineering.md']:
 for link in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  if '://' not in link and not link.startswith('#'):assert (f.parent/link.split('#')[0]).exists(),(f,link)
print(json.dumps({'status':'PASS','pages':pages,'checks':'canonical, title, description, one H1, JSON-LD, image alt, local links, sitemap XML, public entry Markdown links'},ensure_ascii=False,indent=2))
