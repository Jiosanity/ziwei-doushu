"""Verified, resumable streaming import; publish only after complete validation."""
import argparse, calendar, datetime, hashlib, io, json, os, sqlite3, urllib.request, zlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from itertools import islice
import zstandard

BASE = 'https://github.com/Renhuai123/ziwei-doushu/releases/download/v4.0-13d/'
TOPICS = {'overview','personality','love','career','wealth','health','family','children','move','friends','home','spirit','parents'}
p = argparse.ArgumentParser()
p.add_argument('--directory', default='/data')
p.add_argument('--years', nargs='+', type=int, default=list(range(1950, 2027)))
a = p.parse_args()
root = Path(a.directory)
source = root / 'source'
source.mkdir(parents=True, exist_ok=True)
def download(name):
    dest = source / name
    if not dest.exists():
        tmp = dest.with_suffix(dest.suffix + '.part')
        urllib.request.urlretrieve(BASE + name, tmp)
        tmp.replace(dest)
    return dest
checks = {}
for line in download('SHA256SUMS.txt').read_text().splitlines():
    digest, name = line.split(maxsplit=1)
    checks[name.lstrip('*')] = digest
manifest = download('MANIFEST.json')
dbpath = root / 'readings.building.sqlite'
db = sqlite3.connect(dbpath)
pool = ThreadPoolExecutor(max_workers=4)
def compress_record(line):
    r = json.loads(line)
    payload = zlib.compress(json.dumps(r['c'], ensure_ascii=False, separators=(',', ':')).encode(), 6)
    return r, payload

def records(stream):
    while True:
        batch = list(islice(stream, 128))
        if not batch:
            break
        yield from pool.map(compress_record, batch)
db.execute('CREATE TABLE IF NOT EXISTS readings (k TEXT PRIMARY KEY, ms TEXT, content BLOB NOT NULL) WITHOUT ROWID')
db.execute('CREATE TABLE IF NOT EXISTS imported (year INTEGER PRIMARY KEY, count INTEGER NOT NULL, sha256 TEXT NOT NULL)')
db.execute('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
for year in a.years:
    name = f'year-{year}.jsonl.zst'
    if db.execute('SELECT 1 FROM imported WHERE year=? AND sha256=?', (year, checks[name])).fetchone():
        print(f'{year}: already verified', flush=True)
        continue
    path = download(name)
    digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    if digest != checks[name]:
        path.unlink()
        raise ValueError(f'checksum mismatch: {name}; rerun to download again')
    count = 0
    with db:
        with path.open('rb') as compressed:
            with zstandard.ZstdDecompressor(max_window_size=2**31).stream_reader(compressed) as stream:
                for r, payload in records(io.TextIOWrapper(stream, encoding='utf-8')):
                    date = datetime.date(r['y'], r['m'], r['d'])
                    assert date.year == year and type(r['h']) is int and 0 <= r['h'] <= 11
                    assert r['g'] in ('male', 'female')
                    key = f'{date.isoformat()}-{r["h"]}-{r["g"]}'
                    assert r['k'] == key and set(r['c']) == TOPICS
                    assert all(isinstance(v, str) and v.strip() for v in r['c'].values())
                    assert r['ms'] is None or isinstance(r['ms'], str)
                    db.execute('INSERT INTO readings VALUES (?, ?, ?)', (key, r['ms'], payload))
                    count += 1
        expected = (366 if calendar.isleap(year) else 365) * 24
        assert count == expected, (year, count, expected)
        db.execute('INSERT INTO imported VALUES (?, ?, ?)', (year, count, digest))
    print(f'{year}: {count} records verified; database {dbpath.stat().st_size / 1024**2:.1f} MiB', flush=True)
if a.years == list(range(1950, 2027)):
    assert db.execute('SELECT COUNT(*) FROM readings').fetchone()[0] == 674976
    assert db.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    db.execute('INSERT OR REPLACE INTO metadata VALUES (?, ?)', ('version', 'v4.0-13d'))
    db.commit()
    db.close()
    os.chmod(dbpath, 0o644)
    dbpath.replace(root / 'readings.sqlite')
    print('Published readings.sqlite: 674976 records, 77 years, integrity check passed', flush=True)
else:
    db.close()
    print('Pilot complete; database not published. Run without --years for full import.', flush=True)
