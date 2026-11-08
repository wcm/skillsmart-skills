#!/usr/bin/env python3
# Serves the project's site/ on http://localhost:5207 with caching off. A plain static server lets the browser keep old
# pages and frames for hours, so a re-made subject would keep showing its old turn.
#   python3 tools/serve.py [port]
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "site"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5207


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


print(f"http://localhost:{PORT}/  (ctrl-c to stop)")
http.server.ThreadingHTTPServer(("", PORT), functools.partial(NoStore, directory=str(ROOT))).serve_forever()
