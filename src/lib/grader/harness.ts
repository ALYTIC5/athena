/**
 * Python-side helpers, installed once at worker start.
 *
 * Functions take and return JSON strings so no PyProxy conversion is needed.
 * File name `<learner>` marks frames that belong to the learner's code; `<tests>` marks test code.
 */
export const HARNESS_SOURCE = String.raw`
import sys, os, json, shutil, importlib, traceback

_ATHENA_WORK = "/tmp/athena_work"
_athena_baseline = set(sys.modules)

def _athena_rebaseline():
    global _athena_baseline
    _athena_baseline = set(sys.modules)

def _athena_reset():
    for name in list(sys.modules):
        if name not in _athena_baseline:
            del sys.modules[name]
    shutil.rmtree(_ATHENA_WORK, ignore_errors=True)
    os.makedirs(_ATHENA_WORK, exist_ok=True)
    if _ATHENA_WORK in sys.path:
        sys.path.remove(_ATHENA_WORK)
    importlib.invalidate_caches()

def _athena_new_globals():
    return {"__name__": "learner"}

def _athena_exc_text():
    return "".join(traceback.format_exception(*sys.exc_info()))

def _athena_run_tests(payload_json):
    p = json.loads(payload_json)
    _athena_reset()
    ns = {"__name__": "learner"}
    try:
        exec(compile(p["code"], "<learner>", "exec"), ns)
    except BaseException:
        return json.dumps({"error": _athena_exc_text(), "tests": []})
    tns = dict(ns)
    tns["__name__"] = "tests"
    try:
        exec(compile(p["tests"], "<tests>", "exec"), tns)
    except BaseException:
        return json.dumps({"error": _athena_exc_text(), "tests": []})
    results = []
    for name, fn in list(tns.items()):
        if not name.startswith("test_") or not callable(fn):
            continue
        code = getattr(fn, "__code__", None)
        if code is None or code.co_filename != "<tests>":
            continue
        try:
            fn()
            results.append({"name": name, "status": "passed", "message": ""})
        except AssertionError as e:
            msg = str(e) or "assertion failed"
            results.append({"name": name, "status": "failed", "message": msg + "\n" + _athena_exc_text()})
        except BaseException as e:
            results.append({"name": name, "status": "errored", "message": _athena_exc_text()})
    return json.dumps({"tests": results})

def _athena_run_pytest(payload_json):
    p = json.loads(payload_json)
    _athena_reset()
    with open(os.path.join(_ATHENA_WORK, "impl.py"), "w") as f:
        f.write(p["impl"])
    with open(os.path.join(_ATHENA_WORK, "test_learner.py"), "w") as f:
        f.write(p["tests"])
    import pytest
    results = []
    class Recorder:
        def pytest_runtest_logreport(self, report):
            if report.when == "call" or (report.when == "setup" and report.outcome != "passed"):
                status = {"passed": "passed", "failed": "failed"}.get(report.outcome, "errored")
                if report.when == "setup":
                    status = "errored"
                msg = ""
                if report.outcome != "passed":
                    msg = report.longreprtext
                results.append({"name": report.nodeid.split("::")[-1], "status": status, "message": msg})
    sys.path.insert(0, _ATHENA_WORK)
    try:
        code = pytest.main(["-q", "--capture=sys", "-p", "no:cacheprovider", "--rootdir", _ATHENA_WORK, _ATHENA_WORK], plugins=[Recorder()])
    finally:
        if _ATHENA_WORK in sys.path:
            sys.path.remove(_ATHENA_WORK)
    out = {"tests": results}
    if not results:
        out["error"] = "pytest collected no tests (exit code %s)" % int(code)
    return json.dumps(out)
`;

/**
 * Keep only traceback frames from the learner's code (file "<learner>" or "<tests>" for test
 * failures), plus the header and the final exception line. Line numbers already match the editor.
 */
export function trimTraceback(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let keep = true;
  for (const line of lines) {
    const frame = /^\s+File "([^"]*)", line \d+/.exec(line);
    if (frame) {
      keep = frame[1] === '<learner>' || frame[1] === '<tests>' || frame[1] === '<exec>';
      if (keep) out.push(line);
      continue;
    }
    if (/^\s{4,}\S/.test(line) && !keep) continue;
    keep = true;
    out.push(line);
  }
  return out.join('\n').trimEnd();
}
