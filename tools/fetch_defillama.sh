#!/usr/bin/env bash
# Downloads the public DefiLlama datasets used by defillama_merge.py into $1.
set -euo pipefail
out=${1:?usage: fetch_defillama.sh <out_dir>}
mkdir -p "$out"
q='excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true'
curl -sS --fail -o "$out/protocols.json" https://api.llama.fi/protocols
curl -sS --fail -o "$out/lite.json" https://api.llama.fi/lite/protocols2
curl -sS --fail -o "$out/fees.json" "https://api.llama.fi/overview/fees?$q&dataType=dailyFees"
curl -sS --fail -o "$out/revenue.json" "https://api.llama.fi/overview/fees?$q&dataType=dailyRevenue"
curl -sS --fail -o "$out/dexs.json" "https://api.llama.fi/overview/dexs?$q"
