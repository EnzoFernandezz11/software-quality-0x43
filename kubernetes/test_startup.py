"""Pruebas del script sin Docker ni un clúster: python3 -m unittest discover -s kubernetes."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest


FAKE_TOOL = r'''
import json, os, signal, sys, time
from pathlib import Path
entry = {"tool": Path(sys.argv[0]).name, "args": sys.argv[1:], "cwd": os.getcwd()}
with open(os.environ["CALLS"], "a") as log:
    log.write(json.dumps(entry) + "\n")
if "apply" in sys.argv and sys.argv[-1] == "-":
    sys.stdin.read()
if "build" in sys.argv and os.getenv("FAIL_BUILD"):
    sys.exit(1)
if "image" in sys.argv and "ls" in sys.argv:
    print("docker.io/library/soft-eng-flask:local")
    if not os.getenv("MISSING_IMAGE"):
        print("docker.io/library/soft-eng-dashboard:local")
if "status" in sys.argv and os.getenv("FAIL_ROLLOUT"):
    sys.exit(1)
if "port-forward" in sys.argv:
    if os.getenv("FAIL_TUNNEL") and "service/flask-backend" in sys.argv:
        sys.exit(1)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    while True:
        time.sleep(0.1)
if "generic" in sys.argv:
    print("secret simulado")
'''


class StartupTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo con espacios"
        self.repo.mkdir()
        shutil.copy(Path(__file__).resolve().parents[1] / "run_kubernetes.sh", self.repo)
        (self.repo / ".env.example").write_text("POSTGRES_DB=example\n")
        self.calls = self.root / "calls.jsonl"
        tools = self.root / "bin"
        tools.mkdir()
        for name in ("docker", "minikube"):
            tool = tools / name
            tool.write_text(f"#!{sys.executable}\n" + FAKE_TOOL)
            tool.chmod(0o755)
        self.env = {**os.environ, "PATH": f"{tools}:{os.environ['PATH']}", "CALLS": str(self.calls)}

    def entries(self):
        return [json.loads(line) for line in self.calls.read_text().splitlines()]

    def start(self, **flags):
        process = subprocess.Popen(
            ["bash", str(self.repo / "run_kubernetes.sh")], cwd=self.root,
            env={**self.env, **flags}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True,
        )
        self.addCleanup(self.stop, process)
        return process

    @staticmethod
    def stop(process):
        if process.poll() is None:
            process.terminate()
        return process.communicate(timeout=10)

    def test_startup_preserves_env_and_closes_tunnels(self):
        (self.repo / ".env").write_text("POSTGRES_DB=existing\n")
        process = self.start()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.calls.exists() and sum("port-forward" in e["args"] for e in self.entries()) == 3:
                break
            if process.poll() is not None:
                self.fail(process.communicate()[0])
            time.sleep(0.05)
        else:
            self.fail("No se iniciaron los tres túneles")
        output, _ = self.stop(process)
        self.assertEqual(process.returncode, 143, output)
        self.assertIn("Puertos cerrados", output)
        self.assertIn("[5/6]", output)
        self.assertIn("frontend-dashboard listo", output)
        self.assertEqual((self.repo / ".env").read_text(), "POSTGRES_DB=existing\n")
        entries = self.entries()
        self.assertTrue(all(e["cwd"] == str(self.repo) for e in entries))
        self.assertEqual(sum("build" in e["args"] for e in entries), 2)
        self.assertFalse(any("--build-opt" in e["args"] for e in entries))
        self.assertTrue(any("restart" in e["args"] for e in entries))
        self.assertTrue(any(e["tool"] == "docker" and "stop" in e["args"] for e in entries))

    def test_build_failure_copies_env_and_stops_before_deploy(self):
        process = self.start(FAIL_BUILD="1")
        output, _ = process.communicate(timeout=10)
        self.assertNotEqual(process.returncode, 0, output)
        self.assertEqual((self.repo / ".env").read_text(), "POSTGRES_DB=example\n")
        self.assertFalse(any("apply" in e["args"] or "stop" in e["args"] for e in self.entries()))

    def test_broken_tunnel_exits_and_cleans_up_others(self):
        process = self.start(FAIL_TUNNEL="1")
        output, _ = process.communicate(timeout=10)
        self.assertEqual(process.returncode, 1, output)
        self.assertIn("Un port-forward terminó", output)
        self.assertIn("Puertos cerrados", output)

    def test_failed_rollout_prints_diagnostics_without_opening_ports(self):
        process = self.start(FAIL_ROLLOUT="1")
        output, _ = process.communicate(timeout=10)
        self.assertEqual(process.returncode, 1, output)
        self.assertIn("Falló el arranque de postgres", output)
        entries = self.entries()
        self.assertTrue(any("describe" in e["args"] for e in entries))
        self.assertTrue(any("logs" in e["args"] for e in entries))
        self.assertFalse(any("port-forward" in e["args"] for e in entries))

    def test_missing_image_stops_before_deploy_even_when_build_returns_success(self):
        process = self.start(MISSING_IMAGE="1")
        output, _ = process.communicate(timeout=10)
        self.assertEqual(process.returncode, 1, output)
        self.assertIn("No se generó la imagen soft-eng-dashboard:local", output)
        self.assertFalse(any("apply" in e["args"] for e in self.entries()))
