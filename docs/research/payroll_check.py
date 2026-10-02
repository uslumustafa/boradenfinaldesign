#!/usr/bin/env python3
"""
payroll_check.py  --  independent 2026 Turkish payroll (brut -> net) computation
and verification against sourced worked examples.

Written for the Boraden payroll / income-tax calculator research (as of 2026-10-01).
All money is handled with decimal.Decimal and ROUND_HALF_UP to 2 decimals (kurus).

Parameters used (see payroll-params-2026.json for sources):
  * Gelir vergisi tarifesi 2026 (GVK md.103; Gelir Vergisi Genel Tebligi Seri No:332,
    RG 31.12.2025 sayi 33124 5.mukerrer): ucret and ucret disi.
  * SGK prime esas kazanc: alt sinir 33.030,00 / ust sinir 297.270,00 (9 x alt sinir; 7566 s.K.)
  * SGK isci payi %14, issizlik isci %1
  * Damga vergisi on ucret: binde 7,59
  * Asgari ucret (brut 33.030,00) gelir vergisi + damga vergisi istisnasi (GVK 23/1-(18); DVK (2) sayili tablo)
  * Isveren: SGK %21,75 (no incentive) / %19,75 (2 puan, non-manufacturing) / %16,75 (5 puan, imalat,
    until 31.12.2026) + issizlik %2

Usage:
    python3 payroll_check.py                 # run all checks, print report, exit 1 on UNEXPECTED mismatch
    python3 payroll_check.py --emit-json F   # additionally dump vector results as JSON to F
    python3 payroll_check.py --schedule 75000   # print a 12-month schedule for a constant monthly brut
"""
from __future__ import annotations

import json
import sys
from decimal import Decimal as D, ROUND_HALF_UP, getcontext

getcontext().prec = 40


def r2(x) -> D:
    """Round half up to kurus."""
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# 2026 parameters
# ---------------------------------------------------------------------------
ASGARI_BRUT = D("33030.00")
SGK_TABAN = D("33030.00")
SGK_TAVAN = D("297270.00")            # 9 x 33.030
assert SGK_TAVAN == SGK_TABAN * 9

SGK_ISCI = D("0.14")                  # 9% MYO + 5% GSS
ISSIZLIK_ISCI = D("0.01")
SGDP_ISCI = D("0.075")                # emekli calisan (SGDP) isci payi, no issizlik

SGK_ISVEREN_BASE = D("0.2175")        # 12% MYO + 7,5% GSS + 2,25% kisa vadeli (standard assumption)
ISSIZLIK_ISVEREN = D("0.02")
INDIRIM = {"none": D("0"), "2puan": D("0.02"), "5puan": D("0.05")}

DV_RATE = D("0.00759")                # binde 7,59 on ucret
DV_ISTISNA = r2(ASGARI_BRUT * DV_RATE)  # 250,70
ASGARI_DESTEK_GUNLUK = D("42.33")     # TL per prim odeme gunu; 30 gun = 1.269,90 (published as "1.270")

# Gelir vergisi tarifesi 2026: list of (upper_limit, rate); last upper is None
TARIFE_UCRET = [
    (D("190000"), D("0.15")),
    (D("400000"), D("0.20")),
    (D("1500000"), D("0.27")),
    (D("5300000"), D("0.35")),
    (None, D("0.40")),
]
TARIFE_UCRET_DISI = [
    (D("190000"), D("0.15")),
    (D("400000"), D("0.20")),
    (D("1000000"), D("0.27")),
    (D("5300000"), D("0.35")),
    (None, D("0.40")),
]


def income_tax(cum: D, tarife) -> D:
    """Exact (unrounded) progressive tax on a cumulative base."""
    tax, lower = D(0), D(0)
    for upper, rate in tarife:
        if upper is None or cum <= upper:
            return tax + (cum - lower) * rate
        tax += (upper - lower) * rate
        lower = upper
    return tax


# the "tax at upper limit" figures printed in the official tarife must equal our brackets
assert income_tax(D("190000"), TARIFE_UCRET) == D("28500")
assert income_tax(D("400000"), TARIFE_UCRET) == D("70500")
assert income_tax(D("1500000"), TARIFE_UCRET) == D("367500")
assert income_tax(D("5300000"), TARIFE_UCRET) == D("1697500")
assert income_tax(D("1000000"), TARIFE_UCRET_DISI) == D("232500")
assert income_tax(D("5300000"), TARIFE_UCRET_DISI) == D("1737500")


# ---------------------------------------------------------------------------
# Asgari ucret gelir vergisi istisnasi (monthly amounts)
# ---------------------------------------------------------------------------
def asgari_net_components():
    sgk = r2(ASGARI_BRUT * SGK_ISCI)
    iss = r2(ASGARI_BRUT * ISSIZLIK_ISCI)
    return sgk, iss, ASGARI_BRUT - sgk - iss


def asgari_gv_istisna(method: str = "exact_diff", tarife=TARIFE_UCRET):
    """Monthly GV istisnasi = income tax on the minimum wage's own cumulative matrah.

    method='exact_diff'  : month tax = round(tax(cum_m) - tax(cum_{m-1})) using unrounded cumulative taxes
                           (reproduces the published 4.211,33 x6 / 4.537,75 / 5.615,10 x5 schedule)
    method='rounded_cum' : cumulative tax rounded at each step, month = rounded cum - amount already paid
                           (gives alternating 4.211,33 / 4.211,32 in Jan-Jun)
    """
    _, _, matrah = asgari_net_components()
    out, cum, prev, paid = [], D(0), D(0), D(0)
    for _m in range(12):
        cum += matrah
        t = income_tax(cum, tarife)
        if method == "exact_diff":
            out.append(r2(t - prev))
            prev = t
        else:
            tc = r2(t)
            out.append(tc - paid)
            paid = tc
    return out


GV_ISTISNA = asgari_gv_istisna("exact_diff")


# ---------------------------------------------------------------------------
# Core monthly schedule
# ---------------------------------------------------------------------------
def schedule(brut: D | int | str, *, tarife=TARIFE_UCRET, method: str = "exact_diff",
             cum_start: D = D(0), months: int = 12, isci=(SGK_ISCI, ISSIZLIK_ISCI),
             istisna=None, indirim: str = "none", destek: bool = False):
    """12-month (or `months`) schedule for a constant monthly gross salary `brut`.

    Order of operations (what the sourced examples follow):
      brut -> SGK isci (rate x min(brut,tavan)) -> issizlik isci -> GV matrah = brut - SGK - issizlik
      -> cumulative matrah -> GV (tarife on cumulative, minus previous cumulative)
      -> minus asgari ucret GV istisnasi (monthly schedule above; cannot exceed calculated GV)
      -> damga vergisi = brut x 0,00759 minus DV istisnasi 250,70 (cannot exceed calculated DV)
      -> net = brut - SGK - issizlik - GV(after istisna) - DV(after istisna)
    """
    brut = D(brut)
    istisna = GV_ISTISNA if istisna is None else istisna
    spek = max(min(brut, SGK_TAVAN), SGK_TABAN)
    rows = []
    cum, prev_tax, paid = D(cum_start), income_tax(D(cum_start), tarife), r2(income_tax(D(cum_start), tarife))
    for m in range(1, months + 1):
        sgk = r2(spek * isci[0])
        iss = r2(spek * isci[1])
        matrah = brut - sgk - iss
        cum += matrah
        t = income_tax(cum, tarife)
        if method == "exact_diff":
            gv_gross = r2(t - prev_tax)
            prev_tax = t
        else:  # rounded cumulative
            tc = r2(t)
            gv_gross = tc - paid
            paid = tc
        gv_ist = min(gv_gross, istisna[m - 1])
        gv_net = gv_gross - gv_ist
        dv_gross = r2(brut * DV_RATE)
        dv_ist = min(dv_gross, DV_ISTISNA)
        dv_net = dv_gross - dv_ist
        net = brut - sgk - iss - gv_net - dv_net
        rows.append(dict(month=m, brut=brut, spek=spek, sgk=sgk, issizlik=iss, matrah=matrah, cum_matrah=cum,
                         gv_gross=gv_gross, gv_istisna=gv_ist, gv=gv_net,
                         dv_gross=dv_gross, dv_istisna=dv_ist, dv=dv_net, net=net))
    return rows


def employer_cost(brut: D | int | str, indirim: str = "none", destek: bool = False):
    """Isveren maliyeti for one month (30 days). SGK/issizlik computed on min(brut, tavan)."""
    brut = D(brut)
    spek = max(min(brut, SGK_TAVAN), SGK_TABAN)
    sgk_isv = r2(spek * (SGK_ISVEREN_BASE - INDIRIM[indirim]))
    iss_isv = r2(spek * ISSIZLIK_ISVEREN)
    total = brut + sgk_isv + iss_isv
    support = r2(ASGARI_DESTEK_GUNLUK * 30) if destek else D(0)
    return dict(sgk_isveren=sgk_isv, issizlik_isveren=iss_isv, total=total, asgari_ucret_destegi=support,
                total_after_destek=total - support)


# ---------------------------------------------------------------------------
# Sourced vectors  (expected values transcribed from the cited sources)
# ---------------------------------------------------------------------------
def d(x):
    return D(str(x))


# (1) ikyardim.com "Sik Aranan Brut Maas Tutarlari" -- month 1 (Jan) snapshot, no incentive on isveren cost
IKYARDIM_JAN = {
    # brut: (sgk+issizlik, GV, DV, net, isveren maliyeti [teşviksiz])
    33030: ("4954.50", "0.00", "0.00", "28075.50", "40874.63"),
    40000: ("6000.00", "888.67", "52.90", "33058.43", "49500.00"),
    45000: ("6750.00", "1526.17", "90.85", "36632.98", "55687.50"),
    50000: ("7500.00", "2163.67", "128.80", "40207.53", "61875.00"),
    60000: ("9000.00", "3438.67", "204.70", "47356.63", "74250.00"),
    70000: ("10500.00", "4713.67", "280.60", "54505.73", "86625.00"),
    80000: ("12000.00", "5988.67", "356.50", "61654.83", "99000.00"),
    90000: ("13500.00", "7263.67", "432.40", "68803.93", "111375.00"),
    100000: ("15000.00", "8538.67", "508.30", "75953.03", "123750.00"),
    120000: ("18000.00", "11088.67", "660.10", "90251.23", "148500.00"),
    150000: ("22500.00", "14913.67", "887.80", "111698.53", "185625.00"),
    175000: ("26250.00", "18101.17", "1077.55", "129571.28", "216562.50"),
    200000: ("30000.00", "21288.67", "1267.30", "147444.03", "247500.00"),
    250000: ("37500.00", "28788.67", "1646.80", "182064.53", "309375.00"),
    300000: ("44590.50", "37370.57", "2026.30", "216012.63", "370601.63"),   # above tavan 297.270
}

# (2) eleman.net 12-month tables (GV after istisna, net) -- as printed
ELEMAN_50K = dict(
    gv=["2163.67", "2163.67", "2163.67", "2163.67", "3288.67", "4288.67", "3962.25", "2884.90", "2884.90",
        "4634.90", "5859.90", "5859.90"],
    net=["40207.53", "40207.53", "40207.53", "40207.53", "39082.53", "38082.53", "38408.95", "39486.30",
         "39486.30", "37736.30", "36511.30", "36511.30"],
    avg_net="38844.64")
ELEMAN_100K = dict(
    gv=["8538.67", "8538.67", "11788.67", "12788.67", "14538.67", "18738.67", "18412.25", "17334.90", "17334.90",
        "17334.90", "17334.90", "18934.90"],
    net=["75953.03", "75953.03", "72703.03", "71703.03", "69953.03", "65753.03", "66079.45", "67156.80",
         "67156.80", "67156.80", "67156.80", "65556.80"])
ELEMAN_250K = dict(
    gv=["28788.67", "40038.67", "53163.67", "53163.67", "58163.67", "70163.67", "69837.25", "68759.90",
        "68759.90", "68759.90", "68759.90", "68759.90"],
    net=["182064.53", "170814.53", "157689.53", "157689.53", "152689.53", "140689.53", "141015.95",
         "142093.30", "142093.30", "142093.30", "142093.30", "142093.30"],
    total_net="1813119.63")

# (3) published monthly asgari ucret GV istisnasi schedule (Cott Group / EY summary; Ozkansoft)
PUBLISHED_ISTISNA = ["4211.33"] * 6 + ["4537.75"] + ["5615.10"] * 5

# (4) CSGB official asgari ucret table (employer-cost variants)
CSGB = dict(sgk_isci="4624.20", issizlik_isci="330.30", net="28075.50",
            imalat=("5532.53", "660.60", "39223.13"),
            diger=("6523.43", "660.60", "40214.03"),
            tesviksiz=("7184.03", "660.60", "40874.63"))


def fmt(x: D) -> str:
    return f"{x:,.2f}"


class Report:
    def __init__(self):
        self.lines, self.results, self.unexpected = [], [], 0

    def add(self, vid, desc, source, ok, detail="", expected_discrepancy=False, extra=None):
        status = "MATCH" if ok else ("KNOWN-DISCREPANCY" if expected_discrepancy else "MISMATCH")
        if not ok and not expected_discrepancy:
            self.unexpected += 1
        self.results.append(dict(id=vid, description=desc, source=source, status=status, detail=detail,
                                 **(extra or {})))
        self.lines.append(f"[{status:17}] {vid}: {desc}" + (f"\n      {detail}" if detail else ""))


def run_checks():
    rep = Report()

    # --- istisna schedule
    ist = [str(x) for x in GV_ISTISNA]
    rep.add("ISTISNA-GV", "Asgari ucret GV istisnasi, 12 monthly amounts (exact_diff method)",
            "Cott Group/EY summary; Ozkansoft blog", ist == PUBLISHED_ISTISNA, f"computed={ist}")
    alt = [str(x) for x in asgari_gv_istisna('rounded_cum')]
    rep.add("ISTISNA-GV-ROUNDING", "Same schedule with rounded-cumulative method (shows why method matters)",
            "own computation", alt == PUBLISHED_ISTISNA,
            f"rounded_cum={alt}  -> differs by 1 kurus in Feb/Apr/Jun; published table uses exact_diff",
            expected_discrepancy=True)
    rep.add("ISTISNA-DV", "Asgari ucret DV istisnasi = round(33.030 x 0,00759)", "Cott/EY; Ozkansoft; ikyardim",
            DV_ISTISNA == D("250.70"), f"computed={DV_ISTISNA}")

    # --- CSGB asgari ucret
    sgk, iss, matrah = asgari_net_components()
    rows = schedule(ASGARI_BRUT)
    nets = {str(r["net"]) for r in rows}
    ok = (str(sgk) == CSGB["sgk_isci"] and str(iss) == CSGB["issizlik_isci"] and nets == {CSGB["net"]}
          and all(r["gv"] == 0 and r["dv"] == 0 for r in rows))
    rep.add("CSGB-NET", "Asgari ucret 33.030,00: SGK 4.624,20 / issizlik 330,30 / net 28.075,50 in all 12 months",
            "csgb.gov.tr news + asgari-ucret-2026.pdf", ok,
            f"sgk={sgk} iss={iss} matrah={matrah} nets={sorted(nets)}")
    for key, ind in (("imalat", "5puan"), ("diger", "2puan"), ("tesviksiz", "none")):
        c = employer_cost(ASGARI_BRUT, ind)
        exp = CSGB[key]
        ok = (str(c["sgk_isveren"]), str(c["issizlik_isveren"]), str(c["total"])) == exp
        rep.add(f"CSGB-ISVEREN-{key}", f"Isveren maliyeti, asgari ucret, incentive={ind}",
                "csgb.gov.tr asgari-ucret-2026.pdf; EY sirkuler 54", ok,
                f"computed=({c['sgk_isveren']}, {c['issizlik_isveren']}, {c['total']}) expected={exp}")

    # --- Kolay IK January, 50.000
    r = schedule(50000)[0]
    exp = dict(sgk="7000.00", issizlik="500.00", matrah="42500.00", gv_gross="6375.00", gv_istisna="4211.33",
               gv="2163.67", dv_gross="379.50", dv_istisna="250.70", dv="128.80", net="40207.53")
    got = {k: str(r[k]) for k in exp}
    rep.add("KOLAYIK-50K-JAN", "Brut 50.000, January line-by-line", "kolayik.com/blog/brutten-nete-maas-nasil-hesaplanir",
            got == exp, f"computed={got}")

    # --- ikyardim January snapshots
    for brut, (sg_is, gv, dv, net, cost) in IKYARDIM_JAN.items():
        r = schedule(brut)[0]
        c = employer_cost(brut, "none")
        got = (str(r["sgk"] + r["issizlik"]), str(r["gv"]), str(r["dv"]), str(r["net"]), str(c["total"]))
        ok = got == (sg_is, gv, dv, net, cost)
        tag = " [ABOVE SGK TAVAN]" if D(brut) > SGK_TAVAN else ""
        rep.add(f"IKYARDIM-JAN-{brut}", f"Brut {brut:,} January snapshot{tag}", "ikyardim.com/hesaplamalar/brutten-nete-hesaplama",
                ok, f"computed={got} expected={(sg_is, gv, dv, net, cost)}")

    # --- eleman.net 12-month tables
    def compare_table(vid, brut, tbl, desc):
        official = schedule(brut)  # official ucret tarifesi (1.500.000 third limit)
        site_like = schedule(brut, tarife=TARIFE_UCRET_DISI)  # emulate vendor using 1.000.000 limit
        off_gv = [str(x["gv"]) for x in official]
        off_net = [str(x["net"]) for x in official]
        sim_gv = [str(x["gv"]) for x in site_like]
        sim_net = [str(x["net"]) for x in site_like]
        diff_months = [i + 1 for i in range(12) if off_gv[i] != tbl["gv"][i] or off_net[i] != tbl["net"][i]]
        sim_ok = sim_gv == tbl["gv"] and sim_net == tbl["net"]
        detail = (f"official-tarife months that differ from vendor: {diff_months or 'none'}; "
                  f"vendor table reproduced to the kurus when 3rd limit is 1.000.000 (ucret disi): {sim_ok}")
        if diff_months:
            deltas = {m: str(D(tbl['gv'][m - 1]) - D(off_gv[m - 1])) for m in diff_months}
            detail += f"; vendor GV minus official GV by month = {deltas}"
        rep.add(vid, desc, "eleman.net/hesaplama/maas-hesaplama", not diff_months, detail,
                expected_discrepancy=bool(diff_months) and sim_ok,
                extra=dict(official_gv=off_gv, official_net=off_net, vendor_gv=tbl["gv"], vendor_net=tbl["net"],
                           months_differing=diff_months, vendor_reproduced_with_1M_limit=sim_ok))
        return official

    off50 = compare_table("ELEMAN-50K", 50000, ELEMAN_50K, "Brut 50.000, 12 months (crosses 190k in May, 400k in Oct)")
    avg = r2(sum(x["net"] for x in off50) / 12)
    rep.add("ELEMAN-50K-AVG", "Brut 50.000 annual average net", "eleman.net", str(avg) == ELEMAN_50K["avg_net"],
            f"computed={avg} printed={ELEMAN_50K['avg_net']}")
    compare_table("ELEMAN-100K", 100000, ELEMAN_100K,
                  "Brut 100.000, 12 months (crosses 190k in Mar, 400k in May; cum 1.020.000 in Dec)")
    off250 = compare_table("ELEMAN-250K", 250000, ELEMAN_250K,
                           "Brut 250.000, 12 months (cum matrah passes 1.000.000 in May and 1.500.000 in Aug)")
    tot_site = sum(D(x) for x in ELEMAN_250K["net"])
    rep.add("ELEMAN-250K-TOTAL", "Brut 250.000: printed annual net total equals sum of printed months (internal consistency)",
            "eleman.net", str(tot_site) == ELEMAN_250K["total_net"], f"sum(printed months)={tot_site} printed total={ELEMAN_250K['total_net']}")
    tot_off = sum(x["net"] for x in off250)
    rep.add("ELEMAN-250K-OFFICIAL-TOTAL", "Brut 250.000: annual net with OFFICIAL ucret tarifesi vs vendor total",
            "own computation", False, f"official total={tot_off} vs vendor total={tot_site} (diff {tot_off - tot_site})",
            expected_discrepancy=True)

    # --- SGDP (emekli calisan) example from Lebib Yalkin article
    r = schedule(ASGARI_BRUT, isci=(SGDP_ISCI, D(0)))[0]
    printed = dict(sgdp="2477.25", matrah="30552.75", gv_gross="4582.91", istisna="4211.33",
                   kesilecek_gv_printed="317.58", net_printed="30235.17")
    got = dict(sgdp=str(r["sgk"]), matrah=str(r["matrah"]), gv_gross=str(r["gv_gross"]), istisna=str(r["gv_istisna"]),
               gv_net=str(r["gv"]), dv=str(r["dv"]), net=str(r["net"]))
    ok_inputs = (got["sgdp"], got["matrah"], got["gv_gross"], got["istisna"]) == (
        printed["sgdp"], printed["matrah"], printed["gv_gross"], printed["istisna"])
    rep.add("SGDP-ASGARI", "SGDP (emekli calisan) at asgari ucret, January: intermediate lines match; "
            "printed 'Kesilecek GV' 317,58 and net 30.235,17 do NOT (4.582,91-4.211,33 = 371,58)",
            "lebibyalkin.com.tr 2026 ucret hesaplanisi article", ok_inputs and got["net"] == printed["net_printed"],
            f"computed={got}; printed f={printed['kesilecek_gv_printed']}, net={printed['net_printed']} "
            f"-> source transposition error (317,58 vs 371,58); correct net={got['net']}",
            expected_discrepancy=ok_inputs)

    return rep


def print_schedule(brut):
    rows = schedule(brut)
    print(f"2026 schedule, constant monthly brut {fmt(D(brut))} (SGK tavan {fmt(SGK_TAVAN)})")
    hdr = ("Ay", "SGK", "Issizlik", "GV matrah", "Kum. matrah", "GV(brut)", "GV istisna", "GV", "DV", "NET")
    print("{:>3} {:>11} {:>10} {:>13} {:>14} {:>12} {:>10} {:>12} {:>10} {:>13}".format(*hdr))
    for r in rows:
        print("{:>3} {:>11} {:>10} {:>13} {:>14} {:>12} {:>10} {:>12} {:>10} {:>13}".format(
            r["month"], fmt(r["sgk"]), fmt(r["issizlik"]), fmt(r["matrah"]), fmt(r["cum_matrah"]),
            fmt(r["gv_gross"]), fmt(r["gv_istisna"]), fmt(r["gv"]), fmt(r["dv"]), fmt(r["net"])))
    print("Yillik net toplam:", fmt(sum(r["net"] for r in rows)))
    for ind in ("none", "2puan", "5puan"):
        c = employer_cost(brut, ind, destek=False)
        print(f"  isveren maliyeti ({ind}): {fmt(c['total'])}  [SGK {fmt(c['sgk_isveren'])} + issizlik {fmt(c['issizlik_isveren'])}]")


def main(argv):
    if "--schedule" in argv:
        print_schedule(argv[argv.index("--schedule") + 1])
        return 0
    rep = run_checks()
    print("\n".join(rep.lines))
    n = len(rep.results)
    n_match = sum(1 for x in rep.results if x["status"] == "MATCH")
    n_known = sum(1 for x in rep.results if x["status"] == "KNOWN-DISCREPANCY")
    print(f"\nSUMMARY: {n} checks | {n_match} match to the kurus | {n_known} known/explained discrepancies | "
          f"{rep.unexpected} UNEXPECTED mismatches")
    if "--emit-json" in argv:
        path = argv[argv.index("--emit-json") + 1]
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(rep.results, fh, ensure_ascii=False, indent=1, default=str)
    return 1 if rep.unexpected else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
