#!/usr/bin/env python3
"""Compare LLM scoring for the same permalinks across two Supabase projects (prod vs dev).

Read-only: never calls save_scores (no writes to llm_scores / post_scores).

Required environment variables:
  COMPARE_PROD_SUPABASE_URL, COMPARE_PROD_SUPABASE_SERVICE_KEY
  COMPARE_DEV_SUPABASE_URL, COMPARE_DEV_SUPABASE_SERVICE_KEY
  ANTHROPIC_API_KEY

Cost: two independent LLM scoring runs per URL (one per environment) by default,
each using ENSEMBLE_RUNS (typically 3) Haiku calls. Expect small score variance
between runs even with identical inputs.

Usage (from repo root, with venv activated):
  cd scraper && python scripts/compare_env_scores.py urls.txt
  cd scraper && python scripts/compare_env_scores.py --json urls.txt
  cd scraper && python scripts/compare_env_scores.py --configs-only </dev/null

  make compare-env-scores URLS=path/to/urls.txt

Loads scraper/.env and scraper/.env.local (override) automatically, same as other
scraper entrypoints. Variables must be named COMPARE_PROD_* and COMPARE_DEV_*
(not only SUPABASE_URL — that is the single-project scraper default).

If settings.scoring_few_shot is missing in a project, this tool still scores by
using an empty calibration block (production scraper still requires few-shot).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

# Run from scraper/: treat scraper/ as package root
_SCRAPER_ROOT = Path(__file__).resolve().parent.parent
if str(_SCRAPER_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRAPER_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_SCRAPER_ROOT / ".env")
load_dotenv(_SCRAPER_ROOT / ".env.local", override=True)

from anthropic import Anthropic  # noqa: E402
from supabase import create_client  # noqa: E402

from src.compare_env_context import (  # noqa: E402
    body_content_fingerprint,
    collect_env_snapshot,
    dimension_keys,
    explain_final_score,
    resolve_post_row,
)
from src.config import CLAUDE_MODEL, ENSEMBLE_RUNS  # noqa: E402
from src.exceptions import ConfigurationError  # noqa: E402
from src.llm_prompts import PROMPT_VERSION  # noqa: E402
from src.llm_scorer import LLMScorer  # noqa: E402
from src.tuning_posts_lib import parse_tuning_reference  # noqa: E402


class _CompareEnvLLMScorer(LLMScorer):
    """LLMScorer for env comparison only: allow missing settings.scoring_few_shot."""

    def _scoring_few_shot_block(self) -> str:
        try:
            return super()._scoring_few_shot_block()
        except ConfigurationError:
            return ""


def _load_lines(path: Path | None) -> list[str]:
    if path is None:
        return [ln.strip() for ln in sys.stdin.read().splitlines()]
    text = path.read_text(encoding="utf-8")
    return [ln.strip() for ln in text.splitlines()]


def _score_one_readonly(
    anthropic: Anthropic,
    supabase: Any,
    post_row: dict[str, Any],
) -> Any:
    scorer = _CompareEnvLLMScorer(anthropic, supabase)
    posts = [
        {
            "comments": post_row.get("comments"),
            "id": post_row.get("id"),
            "text": post_row.get("text"),
        }
    ]
    results = scorer.score_posts(posts)
    scorer.calculate_final_scores(results)
    return results[0] if results else None


def _serialize_post_score(ps: Any) -> dict[str, Any]:
    if ps is None:
        return {"error": "no result"}
    if ps.error:
        return {"error": ps.error}
    dims = dimension_keys()
    scores_out = {d: round(float(ps.scores.get(d, 0)), 2) for d in dims}
    return {
        "categories": list(ps.categories),
        "dimensions": scores_out,
        "final_score": round(float(ps.final_score), 4)
        if ps.final_score is not None
        else None,
        "summary": (ps.summary or "")[:200],
    }


def _print_snapshot_human(snap: dict[str, Any], dump_few_shot: bool) -> None:
    label = snap["label"]
    print(f"\n=== {label} ===")
    print(f"  active_weight_config_id: {snap.get('active_weight_config_id')}")
    if snap.get("weights_error"):
        print(f"  weights_error: {snap['weights_error']}")
    print(f"  weights: {json.dumps(snap['weights'], indent=2)}")
    print(f"  novelty_config: {json.dumps(snap['novelty_config'], indent=2)}")
    print(
        f"  llm_scores_count: {snap['llm_scores_count']} (cold_start_lt_30={snap['llm_scores_cold_start']})"
    )
    few = snap["few_shot"]
    print(
        f"  scoring_few_shot: present={few['present']} examples={few['example_count']} sha256={few['sha256']}"
    )
    if dump_few_shot:
        raw = snap.get("few_shot_raw")
        print(f"  scoring_few_shot_raw:\n{json.dumps(raw, indent=2, default=str)}")
    mod = snap["model"]
    print(
        f"  code: claude_model={mod['claude']} prompt_version={mod['prompt_version']}"
    )
    print(f"  ENSEMBLE_RUNS: {snap['ensemble_runs']}")


def _print_url_block_human(
    line: str,
    ref_label: str,
    prod_label: str,
    dev_label: str,
    prod_fp: str | None,
    dev_fp: str | None,
    prod_ps: Any,
    dev_ps: Any,
    prod_ex: dict[str, Any],
    dev_ex: dict[str, Any],
    ran_prod: bool,
    ran_dev: bool,
) -> None:
    print(f"\n--- {ref_label} ---")
    print(f"  line: {line!r}")
    match = prod_fp is not None and dev_fp is not None and prod_fp == dev_fp
    if prod_fp and dev_fp:
        print(f"  body_sha256_match: {match}")
        if not match:
            print(f"    {prod_label}: {prod_fp[:16]}…")
            print(f"    {dev_label}: {dev_fp[:16]}…")
    elif prod_fp or dev_fp:
        print("  body_sha256_match: n/a (missing row in one env)")

    blocks = (
        (prod_label, prod_ps, prod_ex, ran_prod),
        (dev_label, dev_ps, dev_ex, ran_dev),
    )
    for label, ps, ex, ran in blocks:
        print(f"\n  [{label}]")
        if not ran:
            print("    (skipped)")
            continue
        if ps is None:
            print("    MISSING post row — not scored")
            continue
        if ps.error:
            print(f"    error: {ps.error}")
            continue
        ser = _serialize_post_score(ps)
        print(
            f"    final_score: {ser.get('final_score')}  categories: {ser.get('categories')}"
        )
        print(
            f"    novelty: {ex.get('novelty')}  final_check: {ex.get('final_score_check')}  "
            f"matches_calculator: {ex.get('matches_post_score')}"
        )
        dims = ser.get("dimensions") or {}
        dim_parts = [f"{k}={dims.get(k)}" for k in dimension_keys()]
        print(f"    dimensions: {', '.join(dim_parts)}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare scoring across two Supabase envs (read-only; no DB writes)."
    )
    parser.add_argument(
        "urls_file",
        nargs="?",
        default=None,
        help="File with newline-separated UUIDs or Nextdoor /p/ URLs (default: stdin)",
    )
    parser.add_argument(
        "--configs-only",
        action="store_true",
        help="Print env snapshots only; do not call the LLM",
    )
    parser.add_argument(
        "--dump-few-shot",
        action="store_true",
        help="Print full scoring_few_shot JSON per environment (can be large)",
    )
    parser.add_argument(
        "--env",
        choices=["both", "dev", "prod"],
        default="both",
        help="Which environment(s) to score (default: both)",
    )
    parser.add_argument(
        "--json", action="store_true", help="Print one JSON object to stdout"
    )
    parser.add_argument(
        "--label-dev",
        default="dev",
        help="Label for dev column (default: dev)",
    )
    parser.add_argument(
        "--label-prod",
        default="prod",
        help="Label for prod column (default: prod)",
    )
    args = parser.parse_args()

    prod_url = os.environ.get("COMPARE_PROD_SUPABASE_URL", "").strip()
    prod_key = os.environ.get("COMPARE_PROD_SUPABASE_SERVICE_KEY", "").strip()
    dev_url = os.environ.get("COMPARE_DEV_SUPABASE_URL", "").strip()
    dev_key = os.environ.get("COMPARE_DEV_SUPABASE_SERVICE_KEY", "").strip()
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    if not prod_url or not prod_key or not dev_url or not dev_key:
        print(
            "Missing COMPARE_*_SUPABASE_URL or COMPARE_*_SUPABASE_SERVICE_KEY",
            file=sys.stderr,
        )
        return 1

    path = Path(args.urls_file) if args.urls_file else None
    if path is not None and not path.is_file():
        print(f"Not a file: {path}", file=sys.stderr)
        return 1

    lines = _load_lines(path)
    lines = [ln for ln in lines if ln and not ln.startswith("#")]

    supabase_prod = create_client(prod_url, prod_key)
    supabase_dev = create_client(dev_url, dev_key)

    snap_prod = collect_env_snapshot(
        supabase_prod,
        label=args.label_prod,
        claude_model=CLAUDE_MODEL,
        prompt_version=PROMPT_VERSION,
        ensemble_runs=ENSEMBLE_RUNS,
    )
    snap_dev = collect_env_snapshot(
        supabase_dev,
        label=args.label_dev,
        claude_model=CLAUDE_MODEL,
        prompt_version=PROMPT_VERSION,
        ensemble_runs=ENSEMBLE_RUNS,
    )

    ran_prod = args.env in ("both", "prod")
    ran_dev = args.env in ("both", "dev")

    meta: dict[str, Any] = {
        "claude_model": CLAUDE_MODEL,
        "ensemble_runs": ENSEMBLE_RUNS,
        "prompt_version": PROMPT_VERSION,
    }
    if (ran_prod and not snap_prod["few_shot"]["present"]) or (
        ran_dev and not snap_dev["few_shot"]["present"]
    ):
        meta["few_shot_compare_mode"] = "empty_block_when_missing"

    def _strip_snapshot(s: dict[str, Any]) -> dict[str, Any]:
        out = {k: v for k, v in s.items() if k != "few_shot_raw"}
        if args.dump_few_shot:
            out["few_shot_raw"] = s.get("few_shot_raw")
        return out

    out_snap_prod = _strip_snapshot(snap_prod)
    out_snap_dev = _strip_snapshot(snap_dev)

    payload: dict[str, Any] | None = None
    if args.json:
        payload = {
            "environments": {
                args.label_prod: out_snap_prod,
                args.label_dev: out_snap_dev,
            },
            "meta": meta,
            "results": [],
        }

    if not args.json:
        print("Compare env scores (read-only)")
        print(
            f"meta: claude_model={meta['claude_model']} prompt_version={meta['prompt_version']} "
            f"ENSEMBLE_RUNS={meta['ensemble_runs']}"
        )
        _print_snapshot_human(snap_prod, args.dump_few_shot)
        _print_snapshot_human(snap_dev, args.dump_few_shot)

    if args.configs_only:
        if args.json:
            print(
                json.dumps(
                    {"environments": payload["environments"], "meta": meta}, indent=2
                )
            )
        return 0

    if not anthropic_key:
        print("ANTHROPIC_API_KEY is required for scoring", file=sys.stderr)
        return 1

    anthropic = Anthropic(api_key=anthropic_key, timeout=120.0)

    if meta.get("few_shot_compare_mode") and not args.json:
        print(
            "\nNote: scoring_few_shot is absent in one or both environments. "
            "Using an empty calibration block for this compare run only "
            "(production scraper still requires Admin → Settings few-shot).\n"
        )

    for line in lines:
        ref = parse_tuning_reference(line)
        if not ref:
            if args.json and payload is not None:
                payload["results"].append({"error": "unparseable line", "line": line})
            elif not args.json:
                print(f"\n(skip) not a UUID or /p/ URL: {line!r}", file=sys.stderr)
            continue

        kind, val = ref
        ref_label = f"{kind}={val}"

        row_p = resolve_post_row(supabase_prod, ref)
        row_d = resolve_post_row(supabase_dev, ref)

        fp_p = (
            body_content_fingerprint(row_p.get("text"), row_p.get("comments"))
            if row_p
            else None
        )
        fp_d = (
            body_content_fingerprint(row_d.get("text"), row_d.get("comments"))
            if row_d
            else None
        )

        ps_p = (
            _score_one_readonly(anthropic, supabase_prod, row_p)
            if (ran_prod and row_p)
            else None
        )
        ps_d = (
            _score_one_readonly(anthropic, supabase_dev, row_d)
            if (ran_dev and row_d)
            else None
        )

        ex_p = (
            explain_final_score(supabase_prod, ps_p)
            if ps_p is not None and not ps_p.error
            else {}
        )
        ex_d = (
            explain_final_score(supabase_dev, ps_d)
            if ps_d is not None and not ps_d.error
            else {}
        )

        if args.json and payload is not None:
            payload["results"].append(
                {
                    "body_sha256": {
                        "dev": fp_d,
                        "match": fp_p == fp_d if fp_p and fp_d else None,
                        "prod": fp_p,
                    },
                    "dev": _serialize_post_score(ps_d) if ran_dev else None,
                    "dev_explain": ex_d if ran_dev else None,
                    "line": line,
                    "prod": _serialize_post_score(ps_p) if ran_prod else None,
                    "prod_explain": ex_p if ran_prod else None,
                    "ref": ref_label,
                    "row_present": {
                        "dev": row_d is not None,
                        "prod": row_p is not None,
                    },
                }
            )
        else:
            _print_url_block_human(
                line,
                ref_label,
                args.label_prod,
                args.label_dev,
                fp_p,
                fp_d,
                ps_p,
                ps_d,
                ex_p,
                ex_d,
                ran_prod,
                ran_dev,
            )

    if args.json:
        print(json.dumps(payload, indent=2, default=str))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
