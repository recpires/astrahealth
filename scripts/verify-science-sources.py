#!/usr/bin/env python3
"""
Independent verification of the scientific resources used by ASTRA Health.

    pip install pypdf
    python3 scripts/verify-science-sources.py            # verify everything
    python3 scripts/verify-science-sources.py --update-fixture   # also rewrite the expected-summary fixtures

What it checks (all against freshly downloaded official files):

1. NASA HRP evidence library (src/data/science/nasa-hrp-evidence.json)
   - title, date and author surnames appear in the official PDF;
   - the risk statement appears verbatim on the Human Research Roadmap risk page;
   - every key quote appears verbatim in its source (PDF or HRR page; "…" splits a quote,
     "[sic]" marks an original typo). Comparison ignores whitespace, case is preserved.

2. NASA OSDR snapshots (src/data/osdr/*.json)
   - study title and public-release date match the OSDR metadata API;
   - the stored file is byte-for-byte identical to a fresh download (size + SHA-256);
   - every value and unit matches the "Submitted Results File" declared in the study's ISA metadata;
   - per-timepoint statistics (n, mean, min, max) recomputed here from the SUBMITTED file match
     tests/fixtures/<ACCESSION>-expected-summary.json, which the TypeScript parser is tested against.

Exit code 0 when every check passes. This script is independent from the application code.
"""
import csv
import hashlib
import html
import io
import json
import re
import statistics
import sys
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "src" / "data" / "science" / "nasa-hrp-evidence.json"
OSDR_DIR = ROOT / "src" / "data" / "osdr"
FIXTURES = ROOT / "tests" / "fixtures"
UA = {"User-Agent": "astra-health-science-verification"}
UNIT_TOKENS = {
    "ng/ml": "nanogram_per_milliliter",
    "pg/ml": "picogram_per_milliliter",
    "ug/ml": "microgram_per_milliliter",
    "µg/ml": "microgram_per_milliliter",
    "mg/dl": "milligram_per_deciliter",
}

results = []


def check(ok, label):
    results.append(bool(ok))
    print(f"  {'OK  ' if ok else 'FAIL'} {label}")
    return ok


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def norm(text):
    t = unicodedata.normalize("NFKC", text)
    for a, b in (("“", '"'), ("”", '"'), ("’", "'"), ("‘", "'"), ("–", "-"), ("—", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", "", t)


def pdf_text(data):
    try:
        import pypdf
    except ImportError:
        sys.exit("pypdf is required: pip install pypdf")
    reader = pypdf.PdfReader(io.BytesIO(data))
    return norm(" ".join((p.extract_text() or "") for p in reader.pages))


def html_text(data):
    s = data.decode("utf-8", errors="ignore")
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    return norm(html.unescape(re.sub(r"<[^>]+>", " ", s)))


def contains_verbatim(haystack, quote):
    pos = 0
    for seg in re.split(r"…|\.\.\.|\[sic\]", quote):
        if not norm(seg):
            continue
        i = haystack.find(norm(seg), pos)
        if i < 0:
            return False
        pos = i
    return True


def verify_evidence():
    lib = json.loads(EVIDENCE.read_text())
    print(f"\n[1] NASA HRP evidence library — {len(lib['entries'])} entries")
    for e in lib["entries"]:
        print(f"\n {e['id']}")
        pdf_url = next(l["url"] for l in e["links"] if l["kind"] == "pdf")
        hrr_url = next(l["url"] for l in e["links"] if l["kind"] == "risk-page")
        pdf = pdf_text(get(pdf_url))
        hrr = html_text(get(hrr_url))
        title = re.sub(r"^Evidence Report:\s*", "", e["title"])
        check(norm(title).lower() in pdf.lower(), f"title in PDF: {title[:70]}")
        date = e["date"].split(":", 1)[1].strip()
        check(norm("Approved for public release: " + date).lower() in pdf.lower(), f"date in PDF: {date}")
        surnames = [a.strip().split()[0].rstrip(",") for a in e["authors"].split(",") if a.strip() and "et al" not in a]
        check(all(norm(s) in pdf for s in surnames), f"author surnames in PDF: {', '.join(surnames)}")
        check(contains_verbatim(hrr, e["riskStatement"]["text"]), "risk statement verbatim on HRR risk page")
        for q in e["keyQuotes"]:
            source = hrr if q["where"].startswith("HRR") else pdf
            check(contains_verbatim(source, q["text"]), f"quote verbatim ({q['where']}): {q['text'][:55]}…")


def osdr_summary(rows):
    groups = {}
    for analyte, timepoint, value in rows:
        groups.setdefault((analyte, timepoint), []).append(value)
    return {
        k: {"n": len(v), "mean": statistics.fmean(v), "min": min(v), "max": max(v)} for k, v in groups.items()
    }


def key_of(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def verify_osdr(update_fixture):
    snaps = sorted(OSDR_DIR.glob("*.json"))
    print(f"\n[2] NASA OSDR snapshots — {len(snaps)}")
    for path in snaps:
        snap = json.loads(path.read_text())
        acc = snap["accession"]
        print(f"\n {acc} / {snap['file']['name']}")
        meta = json.loads(get(snap["metadataApiUrl"]))
        study = meta["study"][acc]["studies"][0]
        check(study["title"] == snap["title"], "study title matches OSDR metadata API")
        check(study.get("publicReleaseDate") == snap["publicReleaseDate"], f"public release date: {snap['publicReleaseDate']}")

        fresh = get(snap["file"]["downloadUrl"])
        stored = snap["content"].encode("utf-8")
        check(len(fresh) == snap["file"]["bytes"], f"size {len(fresh)} B")
        check(hashlib.sha256(fresh).hexdigest() == snap["file"]["sha256"], "SHA-256 of fresh download matches the recorded value")
        check(fresh == stored, "stored content is byte-for-byte identical to the fresh download")

        # Locate the submitted results file through the ISA metadata.
        files = json.loads(get(snap["filesApiUrl"]))["studies"][acc]["study_files"]
        isa = next(f for f in files if f["category"] == "Study Metadata Files" and f["file_name"].endswith(".zip"))
        submitted_name = None
        with zipfile.ZipFile(io.BytesIO(get("https://osdr.nasa.gov" + isa["remote_url"]))) as z:
            for n in z.namelist():
                if not n.split("/")[-1].startswith("a_"):
                    continue
                rows = list(csv.DictReader(io.StringIO(z.read(n).decode("utf-8-sig")), delimiter="\t"))
                for r in rows:
                    if r.get("Parameter Value[Transformed Files]") == snap["file"]["name"]:
                        submitted_name = r.get("Parameter Value[Submitted Results File]")
        if not check(submitted_name, f"ISA metadata declares the submitted file: {submitted_name}"):
            continue
        sub_file = next(f for f in files if f["file_name"] == submitted_name)
        submitted = list(csv.DictReader(io.StringIO(get("https://osdr.nasa.gov" + sub_file["remote_url"]).decode("utf-8-sig"))))

        transformed = list(csv.DictReader(io.StringIO(fresh.decode("utf-8-sig"))))
        cols = {}
        for c in transformed[0]:
            m = re.match(r"(.+)_concentration_(.+)$", c)
            if m:
                cols[key_of(m.group(1))] = (c, m.group(2), m.group(1))
        by_sample = {}
        for r in transformed:
            subj, _, tp = r["Sample Name"].split("_")
            by_sample[(subj, tp)] = r
        value_bad = unit_bad = 0
        sub_rows = []
        for r in submitted:
            col, unit_token, key = cols[key_of(r["Analyte"])]
            if UNIT_TOKENS.get(r["Unit"].lower()) != unit_token:
                unit_bad += 1
            if float(by_sample[(r["ID"], r["Timepoint"])][col]) != float(r["Concentration"]):
                value_bad += 1
            sub_rows.append((key, r["Timepoint"], float(r["Concentration"])))
        check(value_bad == 0, f"{len(submitted)} values identical in transformed and submitted files")
        check(unit_bad == 0, "units match (submitted 'Unit' column vs transformed column names)")

        stats = osdr_summary(sub_rows)
        expected = {
            "accession": acc,
            "source": f"{submitted_name} (OSDR submitted results file)",
            "method": "Python 3 csv + statistics.fmean, independent from the TypeScript parser",
            "groups": [{"analyte": a, "timepoint": t, **v} for (a, t), v in sorted(stats.items())],
        }
        fixture = FIXTURES / f"{acc}-expected-summary.json"
        if update_fixture:
            fixture.write_text(json.dumps(expected, indent=1) + "\n")
            print(f"  (fixture written: {fixture.relative_to(ROOT)})")
        if check(fixture.exists(), f"fixture present: {fixture.relative_to(ROOT)}"):
            committed = json.loads(fixture.read_text())["groups"]
            same = len(committed) == len(expected["groups"]) and all(
                a["analyte"] == b["analyte"] and a["timepoint"] == b["timepoint"] and a["n"] == b["n"]
                and all(abs(a[f] - b[f]) <= 1e-12 * max(1.0, abs(b[f])) for f in ("mean", "min", "max"))
                for a, b in zip(committed, expected["groups"])
            )
            check(same, f"{len(expected['groups'])} groups × 4 statistics match the committed fixture")


def main():
    update = "--update-fixture" in sys.argv
    verify_evidence()
    verify_osdr(update)
    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
