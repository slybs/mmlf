#!/usr/bin/env python3
"""Tiny local server for the notes feature.

Serves the whole site (http://127.0.0.1:8765/ works like index.html)
and exposes one API used by notes.html:

  GET  /api/notes            -> {"ok": true, "notes": [...]}
  POST /api/notes  {"notes": [...]} -> writes data/notes.js

Standard library only, no dependencies.
Usage: double-click start-server.command (macOS) / start-server.bat (Windows),
or run:  python3 tools/notes-server.py
"""
import json
import os
import re
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTES_FILE = os.path.join(ROOT, "data", "notes.js")
PORT = 8765


def read_notes():
    try:
        with open(NOTES_FILE, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return []
    m = re.search(r"window\.NOTES\s*=\s*([\s\S]*?)\s*;\s*$", text)
    if not m:
        return []
    try:
        v = json.loads(m.group(1))
        return v if isinstance(v, list) else []
    except ValueError:
        return []


def write_notes(notes):
    text = "window.NOTES = " + json.dumps(notes, ensure_ascii=False, indent=2) + ";\n"
    with open(NOTES_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _route(self):
        return self.path.split("?", 1)[0]

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self._route() == "/api/notes":
            self._send_json({"ok": True, "notes": read_notes()})
        else:
            super().do_GET()

    def do_POST(self):
        if self._route() == "/api/notes":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                notes = data.get("notes")
                if not isinstance(notes, list):
                    raise ValueError("notes must be a list")
                write_notes(notes)
                self._send_json({"ok": True})
            except (ValueError, OSError) as e:
                self._send_json({"ok": False, "error": str(e)}, 400)
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        pass


def main():
    url = "http://127.0.0.1:%d/" % PORT
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        print("Port %d unavailable: %s" % (PORT, e))
        print("Maybe the server is already running at %s" % url)
        raise SystemExit(1)
    print("MLF report server running at %s  (Ctrl+C to stop)" % url)
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBye.")


if __name__ == "__main__":
    main()
