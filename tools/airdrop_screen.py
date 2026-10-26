import json,sys
R=json.load(open(sys.argv[1]+'/merged.json'))
EX={'CEX','Chain','Canonical Bridge','Bridge','Risk Curators','Onchain Capital Allocator','RWA','Staking Pool','Crypto Card Issuer','Payments','CeDeFi','Cross Chain Bridge','OTC Marketplace','Anchor BTC'}
M=lambda x:'-' if x is None else ('%.1fB'%(x/1e9) if x>=1e9 else '%.1fM'%(x/1e6) if x>=1e6 else '%.0fk'%(x/1e3))
P=lambda x:'-' if x is None else '%+.0f%%'%x
T=[r for r in R if not r['has_token'] and r['category'] not in EX and (r['tvl'] or 0)>=float(sys.argv[2])]
key=sys.argv[3]
T.sort(key=lambda r:-(r[key] or 0) if key!='score' else 0)
if key=='score':
    import math
    def s(r):
        g=r['chg_1m'] or 0; fe=r['fees_30d'] or 0
        return math.log10(r['tvl'])+ max(min(g,300),-50)/50 + (math.log10(fe+1)/2 if fe else 0) + (1 if (r['listed_days'] or 9999)<365 else 0)
    T.sort(key=lambda r:-s(r))
print('%-30s %-22s %-24s %8s %6s %6s %8s %8s %8s %5s'%('name','parent','category','tvl','1m','7d','fees30','rev30','dexvol30','age'))
for r in T[:int(sys.argv[4])]:
    print('%-30s %-22s %-24s %8s %6s %6s %8s %8s %8s %5s'%(r['name'][:30],r['parent'][:22],(r['category'] or '')[:24],M(r['tvl']),P(r['chg_1m']),P(r['chg_7d']),M(r['fees_30d']),M(r['rev_30d']),M(r['dex_vol_30d']),r['listed_days']))
