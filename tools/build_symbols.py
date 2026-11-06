#!/usr/bin/env python3
"""Builds docs/symbols.txt (search list for the watchlist) from Nasdaq's public
symbol directory: https://www.nasdaqtrader.com/dynamic/SymDir/{nasdaqlisted,otherlisted}.txt
Usage: python3 tools/build_symbols.py <dir with the two .txt files>
Output lines: SYMBOL|Name|Exchange|E (E = ETF)"""
import pathlib, re, sys
src = pathlib.Path(sys.argv[1])
EX = {"N": "NYSE", "A": "NYSE American", "P": "NYSE Arca", "Z": "Cboe", "V": "IEX"}
SKIP = re.compile(r"\b(warrants?|rights?|units?|subordinated|notes? due|debentures?|preferred|depositary shares,? each representing a 1/)\b", re.I)
TAIL = re.compile(r"\s*-?\s*(class [a-z] )?(common stock|common shares|ordinary shares|shares of beneficial interest|common units)\b.*$", re.I)

def clean(name):
    name = name.strip()
    if " - " in name:
        name = name.split(" - ")[0]
    name = TAIL.sub("", name).strip(" ,-")
    return name.replace("|", "/")

rows = {}
for line in (src / "nasdaqlisted.txt").read_text().splitlines()[1:]:
    p = line.split("|")
    if len(p) < 8 or p[3] != "N" or not re.fullmatch(r"[A-Z]{1,5}", p[0]) or SKIP.search(p[1]):
        continue
    rows[p[0]] = (clean(p[1]), "NASDAQ", "E" if p[6] == "Y" else "")
for line in (src / "otherlisted.txt").read_text().splitlines()[1:]:
    p = line.split("|")
    if len(p) < 8 or p[6] != "N" or not re.fullmatch(r"[A-Z]{1,5}", p[0]) or SKIP.search(p[1]):
        continue
    rows.setdefault(p[0], (clean(p[1]), EX.get(p[2], p[2]), "E" if p[4] == "Y" else ""))

extra = [  # crypto, currencies and indices people often watch
    ("BITSTAMP:BTCUSD", "Bitcoin / US Dollar", "Crypto", ""), ("BITSTAMP:ETHUSD", "Ethereum / US Dollar", "Crypto", ""),
    ("COINBASE:SOLUSD", "Solana / US Dollar", "Crypto", ""), ("BITSTAMP:XRPUSD", "XRP / US Dollar", "Crypto", ""),
    ("FX_IDC:USDILS", "US Dollar / Israeli Shekel (דולר שקל)", "Forex", ""), ("FX:EURUSD", "Euro / US Dollar", "Forex", ""),
    ("FX:USDJPY", "US Dollar / Japanese Yen", "Forex", ""), ("FX:GBPUSD", "British Pound / US Dollar", "Forex", ""),
    ("FOREXCOM:SPXUSD", "S&P 500 Index", "Index", ""), ("FOREXCOM:NSXUSD", "Nasdaq 100 Index", "Index", ""),
    ("FOREXCOM:DJI", "Dow Jones Industrial Average", "Index", ""), ("TVC:GOLD", "Gold Spot", "Commodity", ""),
    ("TVC:SILVER", "Silver Spot", "Commodity", ""), ("TVC:USOIL", "Crude Oil WTI", "Commodity", ""),
]
HE = {"TEVA": "טבע", "CHKP": "צ'ק פוינט", "NICE": "נייס", "ESLT": "אלביט", "WIX": "וויקס", "MNDY": "מאנדיי", "FVRR": "פייבר",
      "DOX": "אמדוקס", "TSEM": "טאואר", "ICL": "כיל", "ORA": "אורמת", "SEDG": "סולאראדג'", "LMND": "למונייד", "NVMI": "נובה",
      "CAMT": "קמטק", "GLBE": "גלובל אי", "CYBR": "סייברארק", "INMD": "אינמוד", "AAPL": "אפל", "TSLA": "טסלה", "NVDA": "אנבידיה",
      "AMZN": "אמזון", "GOOGL": "גוגל", "GOOG": "גוגל", "MSFT": "מיקרוסופט", "META": "מטא פייסבוק", "NFLX": "נטפליקס", "AMD": "איי אם די",
      "INTC": "אינטל", "PLTR": "פלנטיר", "COIN": "קוינבייס", "MSTR": "מיקרוסטרטג'י", "BMNR": "ביטמיין", "SPY": "אס אנד פי", "QQQ": "נאסדק"}
for k, h in HE.items():
    if k in rows:
        n, x, e = rows[k]; rows[k] = (f"{n} · {h}", x, e)
out = [f"{s}|{n}|{x}|{e}" for s, n, x, e in extra] + [f"{s}|{n}|{x}|{e}" for s, (n, x, e) in sorted(rows.items())]
pathlib.Path(__file__).parent.parent.joinpath("docs/symbols.txt").write_text("\n".join(out) + "\n", encoding="utf-8")
print(len(out), "symbols")
