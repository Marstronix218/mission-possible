from pathlib import Path
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
import subprocess,json
cities=[('los-angeles',-118.24,34.05),('houston',-95.37,29.76),('phoenix',-112.07,33.45)]
r=Path(__file__).resolve().parents[2]/'public/nasa';r.mkdir(parents=True,exist_ok=True)
def get(row):
 slug,lon,lat=row
 params=dict(SERVICE='WMS',REQUEST='GetMap',VERSION='1.1.1',LAYERS='MODIS_Terra_CorrectedReflectance_TrueColor',FORMAT='image/jpeg',WIDTH=512,HEIGHT=512,SRS='EPSG:4326',BBOX=f'{lon-.8},{lat-.5},{lon+.8},{lat+.5}',TIME='2024-07-01')
 url='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?'+urlencode(params)
 p=r/f'{slug}.jpg';subprocess.run(['curl','-fLsS','--max-time','45',url,'-o',str(p)],check=True)
 assert p.read_bytes()[:2]==b'\xff\xd8',p.read_text()[:500]
 (r/f'{slug}.json').write_text(json.dumps({'source':'NASA GIBS / Terra MODIS corrected reflectance, true color','observedOn':'2024-07-01','accessedOn':'2026-11-14','bbox':[lon-.8,lat-.5,lon+.8,lat+.5],'url':url,'usage':'Observed true-color imagery for geographical context. Not a hazard label or scoring ground truth.'},indent=2))
 return slug
with ThreadPoolExecutor(max_workers=3) as p:
 for slug in p.map(get,cities):print(slug,'verified JPEG')
