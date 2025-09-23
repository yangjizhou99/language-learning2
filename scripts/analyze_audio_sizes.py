#!/usr/bin/env python3
"""
Analyze audio file size distribution from Supabase storage.objects in Postgres.

- Connects using a Postgres DSN
- Filters audio by extension or metadata mimetype
- Computes per-bucket and overall stats, histograms, and percentiles

Usage examples:
  python scripts/analyze_audio_sizes.py \
    --dsn postgresql://postgres:postgres@127.0.0.1:5432/postgres

  python scripts/analyze_audio_sizes.py \
    --dsn postgresql://postgres:postgres@127.0.0.1:5432/postgres \
    --output-csv audio_sizes.csv

Optional:
  --bucket <bucket_id>   Only analyze a specific bucket
  --bins 0,100K,1M,5M,10M,50M,100M,1G   Custom histogram bins
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import psycopg2
import psycopg2.extras


AudioExtensions = (
    ".mp3",
    ".wav",
    ".webm",
    ".ogg",
    ".m4a",
    ".aac",
    ".flac",
    ".opus",
    ".amr",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze audio file size distribution in storage.objects")
    parser.add_argument(
        "--dsn",
        type=str,
        default=os.environ.get("DATABASE_URL", ""),
        help="Postgres DSN, e.g. postgresql://user:pass@host:port/db (default: $DATABASE_URL)",
    )
    parser.add_argument(
        "--bucket",
        type=str,
        default=None,
        help="Only analyze a specific bucket_id",
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        default=None,
        help="Optional path to write raw results (bucket_id,name,size_bytes) to CSV",
    )
    parser.add_argument(
        "--bins",
        type=str,
        default="0,100K,1M,5M,10M,50M,100M,1G",
        help="Comma-separated histogram bin boundaries (supports K/M/G suffix)",
    )
    return parser.parse_args()


def parse_size_token(token: str) -> int:
    t = token.strip().upper()
    if t.endswith("K"):
        return int(float(t[:-1]) * 1024)
    if t.endswith("M"):
        return int(float(t[:-1]) * 1024 * 1024)
    if t.endswith("G"):
        return int(float(t[:-1]) * 1024 * 1024 * 1024)
    return int(float(t))


def parse_bins(text: str) -> List[int]:
    try:
        bins = sorted({parse_size_token(p) for p in text.split(",") if p.strip() != ""})
        if bins[0] != 0:
            bins = [0] + bins
        return bins
    except Exception as exc:
        raise SystemExit(f"Invalid --bins value: {text} ({exc})")


@dataclass
class FileRow:
    bucket_id: str
    name: str
    size_bytes: int
    mimetype: str


def connect(dsn: str):
    if not dsn:
        raise SystemExit("Missing DSN. Provide --dsn or set $DATABASE_URL")
    try:
        return psycopg2.connect(dsn)
    except Exception as exc:
        raise SystemExit(f"Failed to connect to Postgres: {exc}")


def fetch_audio_files(conn, bucket_filter: Optional[str]) -> List[FileRow]:
    sql = r"""
    SELECT
      bucket_id,
      name,
      COALESCE((metadata->>'size')::bigint, 0) AS size_bytes,
      COALESCE(metadata->>'mimetype', '') AS mimetype
    FROM storage.objects
    WHERE (
      lower(name) ~ '\\.(mp3|wav|webm|ogg|m4a|aac|flac|opus|amr)$'
      OR COALESCE(metadata->>'mimetype','') ILIKE 'audio/%'
    )
    {bucket_clause}
    ;
    """
    bucket_clause = ""
    params: Tuple = tuple()
    if bucket_filter:
        bucket_clause = "AND bucket_id = %s"
        params = (bucket_filter,)
    final_sql = sql.format(bucket_clause=bucket_clause)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(final_sql, params)
            rows = cur.fetchall()
            return [
                FileRow(
                    bucket_id=row["bucket_id"],
                    name=row["name"],
                    size_bytes=int(row["size_bytes"]) if row["size_bytes"] is not None else 0,
                    mimetype=row["mimetype"] or "",
                )
                for row in rows
            ]
    except psycopg2.errors.UndefinedTable:
        raise SystemExit("Table storage.objects not found. Ensure Supabase storage is installed in this database.")
    except Exception as exc:
        raise SystemExit(f"Query failed: {exc}")


def format_bytes(num_bytes: int) -> str:
    if num_bytes is None:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} PB"


def compute_percentiles(values: Sequence[int], percentiles: Sequence[float]) -> Dict[float, int]:
    if not values:
        return {p: 0 for p in percentiles}
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    result: Dict[float, int] = {}
    for p in percentiles:
        if p <= 0:
            result[p] = sorted_vals[0]
            continue
        if p >= 1:
            result[p] = sorted_vals[-1]
            continue
        # Nearest-rank method
        k = max(1, int(math.ceil(p * n)))
        result[p] = sorted_vals[k - 1]
    return result


def make_histogram(bins: Sequence[int], values: Sequence[int]) -> List[Tuple[str, int]]:
    if not values:
        labels = []
        for i in range(len(bins) - 1):
            labels.append(f"[{format_bytes(bins[i])}, {format_bytes(bins[i+1])})")
        labels.append(f">= {format_bytes(bins[-1])}")
        return [(label, 0) for label in labels]

    counts = [0 for _ in range(len(bins))]
    for v in values:
        placed = False
        for i in range(len(bins) - 1):
            if bins[i] <= v < bins[i + 1]:
                counts[i] += 1
                placed = True
                break
        if not placed:
            counts[-1] += 1

    labels = []
    for i in range(len(bins) - 1):
        labels.append(f"[{format_bytes(bins[i])}, {format_bytes(bins[i+1])})")
    labels.append(f">= {format_bytes(bins[-1])}")
    return list(zip(labels, counts))


def print_section(title: str):
    print("\n" + "=" * 8 + f" {title} " + "=" * 8)


def analyze(rows: List[FileRow], bins: Sequence[int]) -> None:
    total_count = len(rows)
    total_bytes = sum(r.size_bytes for r in rows)
    sizes = [r.size_bytes for r in rows]

    print_section("Overall Summary (Audio Files)")
    print(f"Files: {total_count}")
    print(f"Total Size: {format_bytes(total_bytes)}")
    print(f"Average Size: {format_bytes(int(total_bytes / total_count)) if total_count else '0 B'}")

    pct = compute_percentiles(sizes, [0.5, 0.75, 0.9, 0.95, 0.99]) if sizes else {}
    if pct:
        print("Percentiles:")
        for k in [0.5, 0.75, 0.9, 0.95, 0.99]:
            print(f"  p{int(k*100)}: {format_bytes(pct[k])}")

    print("Histogram:")
    hist = make_histogram(bins, sizes)
    for label, count in hist:
        share = (count / total_count * 100.0) if total_count else 0.0
        print(f"  {label:<22} {count:>8}  ({share:5.1f}%)")

    # Per-bucket breakdown
    print_section("Per-Bucket Summary")
    by_bucket: Dict[str, List[FileRow]] = {}
    for r in rows:
        by_bucket.setdefault(r.bucket_id, []).append(r)

    for bucket_id, bucket_rows in sorted(by_bucket.items(), key=lambda kv: sum(x.size_bytes for x in kv[1]), reverse=True):
        count_b = len(bucket_rows)
        total_b = sum(r.size_bytes for r in bucket_rows)
        sizes_b = [r.size_bytes for r in bucket_rows]
        avg_b = int(total_b / count_b) if count_b else 0
        print(f"- bucket_id={bucket_id} | files={count_b} | total={format_bytes(total_b)} | avg={format_bytes(avg_b)}")
        hist_b = make_histogram(bins, sizes_b)
        for label, count in hist_b:
            share_b = (count / count_b * 100.0) if count_b else 0.0
            print(f"    {label:<22} {count:>8}  ({share_b:5.1f}%)")


def write_csv(path: str, rows: List[FileRow]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["bucket_id", "name", "size_bytes", "mimetype"])
        for r in rows:
            w.writerow([r.bucket_id, r.name, r.size_bytes, r.mimetype])
    print(f"\nSaved CSV: {path}")


def main() -> None:
    args = parse_args()
    bins = parse_bins(args.bins)
    conn = connect(args.dsn)
    try:
        rows = fetch_audio_files(conn, args.bucket)
    finally:
        conn.close()

    if not rows:
        print("No audio files found in storage.objects.")
        return

    analyze(rows, bins)

    if args.output_csv:
        write_csv(args.output_csv, rows)


if __name__ == "__main__":
    main()


