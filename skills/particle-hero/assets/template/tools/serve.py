#!/usr/bin/env python3
"""Serves the site with caching off, so every reload shows your last edit.

    python3 tools/serve.py [port]      → http://localhost:5206/<id>/
"""
import functools, http.server, sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5206


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCache, directory=str(SITE))
    print(f"http://localhost:{PORT}/  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("", PORT), handler).serve_forever()
