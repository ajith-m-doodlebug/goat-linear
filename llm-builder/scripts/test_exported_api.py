#!/usr/bin/env python3
"""Test script for the exported RAG API. Run the exported API (e.g. docker-compose up), then run this script."""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def req(base_url: str, method: str, path: str, body: dict | None = None, timeout: int = 60) -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    data = json.dumps(body).encode() if body else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=timeout) as r:
        return json.loads(r.read().decode())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test exported RAG API (health + chat completion). Each export uses a different port (see bundle README)."
    )
    parser.add_argument(
        "--url",
        help="API base URL (e.g. http://localhost:8001). Each export uses a port in 8001-8999 (see bundle README).",
    )
    parser.add_argument(
        "--port",
        type=int,
        help="Host port for exported API (8001-8999). Builds http://localhost:PORT. Ignored if --url is set.",
    )
    parser.add_argument(
        "--question",
        default="What is the main topic of the documents?",
        help="User message to send to /v1/chat/completions",
    )
    args = parser.parse_args()

    if args.url:
        base_url = args.url
    elif args.port is not None:
        base_url = f"http://localhost:{args.port}"
    else:
        base_url = "http://localhost:8001"

    print(f"Base URL: {base_url}\n")

    # Health check (retry a few times in case the server is still starting / seeding Qdrant)
    print("1. GET /health")
    health = None
    for attempt in range(1, 4):
        try:
            health = req(base_url, "GET", "/health")
            break
        except urllib.error.HTTPError as e:
            print(f"   HTTP {e.code}: {e.reason}\n", file=sys.stderr)
            return 1
        except urllib.error.URLError as e:
            if attempt < 3:
                print(f"   Attempt {attempt}: {e.reason or e}. Retrying in 2s...")
                time.sleep(2)
            else:
                print(f"   Error: {e.reason or e}\n", file=sys.stderr)
                print("   Tip: Is the exported API running? (e.g. docker compose up -d in the bundle folder.)", file=sys.stderr)
                return 1
        except OSError as e:
            if attempt < 3:
                print(f"   Attempt {attempt}: {e}. Retrying in 2s...")
                time.sleep(2)
            else:
                print(f"   Error: {e}\n", file=sys.stderr)
                print("   Tip: Is the exported API running? Try: docker compose ps (in the bundle folder).", file=sys.stderr)
                return 1
    if health is not None:
        print(f"   {json.dumps(health)}\n")

    # Chat completion
    print("2. POST /v1/chat/completions")
    payload = {"messages": [{"role": "user", "content": args.question}]}
    try:
        resp = req(base_url, "POST", "/v1/chat/completions", payload)
        content = (
            resp.get("choices", [{}])[0].get("message", {}).get("content", "")
        )
        print(f"   Response (excerpt): {json.dumps(resp, indent=2)[:500]}...")
        print(f"\n   Assistant: {content}\n")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"   HTTP {e.code}: {e.reason}\n   {body[:300]}\n", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"   Error: {e.reason or e}\n", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"   Error: {e}\n", file=sys.stderr)
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
