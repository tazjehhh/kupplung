import json, sys, time, csv
D = sys.argv[1]
J = lambda f: json.load(open(f"{D}/{f}"))
full = {p['id']: p for p in J('protocols.json')}
lite = J('lite.json')
parents = {p['id']: p for p in lite['parentProtocols']}
def overview(f):
    m = {}
    for p in J(f)['protocols']:
        m[str(p.get('defillamaId') or p.get('id'))] = p
    return m
fees, rev, dex = overview('fees.json'), overview('revenue.json'), overview('dexs.json')
f = lambda x: float(x) if x not in (None, '', 'None') else None
now = time.time()
rows = []
for p in lite['protocols']:
    pid = str(p.get('defillamaId'))
    fp = full.get(pid, {})
    par = parents.get(fp.get('parentProtocol') or '', {})
    sym = fp.get('symbol') or p.get('symbol')
    has_token = bool((sym and sym != '-') or fp.get('gecko_id') or p.get('geckoId') or par.get('gecko_id') or (par.get('symbol') not in (None, '-')))
    tvl, prev_m, prev_w = f(p.get('tvl')), f(p.get('tvlPrevMonth')), f(p.get('tvlPrevWeek'))
    def g(m, k): return f(m.get(pid, {}).get(k))
    rows.append(dict(
        id=pid, name=p['name'], parent=par.get('name', ''), category=p.get('category'),
        chains=','.join((fp.get('chains') or [])[:4]), has_token=has_token, symbol=sym or '',
        tvl=tvl, tvl_prev_month=prev_m, tvl_prev_week=prev_w,
        chg_1m=(tvl/prev_m-1)*100 if tvl and prev_m else None,
        chg_7d=(tvl/prev_w-1)*100 if tvl and prev_w else None,
        listed_days=round((now-fp['listedAt'])/86400) if fp.get('listedAt') else None,
        fees_30d=g(fees,'total30d'), fees_prev30d=g(fees,'total60dto30d'),
        rev_30d=g(rev,'total30d'), dex_vol_30d=g(dex,'total30d'), dex_vol_prev30d=g(dex,'total60dto30d'),
        twitter=fp.get('twitter') or '', url=fp.get('url') or '', slug=fp.get('slug') or ''))
json.dump(rows, open(f"{D}/merged.json", 'w'))
print(len(rows), sum(r['has_token'] for r in rows))
