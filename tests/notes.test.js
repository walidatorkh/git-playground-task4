const test = require("node:test");
const assert = require("node:assert");

const { matches } = require("../lib/store");

const notes = [
  { id: 1, text: "buy milk" },
  { id: 2, text: "call the bank" },
  { id: 3, text: "milk the almonds" },
];

test("search finds every note that contains the term", () => {
  const result = matches(notes, "milk");
  assert.strictEqual(result.length, 2);
});

test("search finds a single containing note", () => {
  const result = matches(notes, "bank");
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 2);
});

test("search returns nothing when no note contains the term", () => {
  const result = matches(notes, "xyz");
  assert.strictEqual(result.length, 0);
});

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// edit() reads and writes a notes file, so run it against a temp file via
// NOTES_FILE instead of the real notes.json.
function withTempStore(initial, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notes-"));
  const file = path.join(dir, "notes.json");
  fs.writeFileSync(file, JSON.stringify(initial));
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runStore(file, code) {
  return execFileSync(process.execPath, ["-e", code], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, NOTES_FILE: file },
    encoding: "utf8",
  });
}

const seed = { nextId: 3, notes: [{ id: 1, text: "buy milk" }, { id: 2, text: "call the bank" }] };

test("edit updates the text of an existing note and returns true", () => {
  withTempStore(seed, (file) => {
    const out = runStore(
      file,
      `const s = require("./lib/store");
       console.log(s.edit(2, "call the dentist"));
       console.log(JSON.stringify(s.all()));`
    );
    const [returned, saved] = out.trim().split("\n");
    assert.strictEqual(returned, "true");
    assert.deepStrictEqual(JSON.parse(saved), [
      { id: 1, text: "buy milk" },
      { id: 2, text: "call the dentist" },
    ]);
  });
});

test("edit returns false and leaves notes unchanged for an unknown id", () => {
  withTempStore(seed, (file) => {
    const out = runStore(
      file,
      `const s = require("./lib/store");
       console.log(s.edit(99, "nope"));`
    );
    assert.strictEqual(out.trim(), "false");
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, "utf8")), seed);
  });
});

test("notes edit reports a missing note instead of crashing", () => {
  withTempStore(seed, (file) => {
    const out = execFileSync(process.execPath, ["notes.js", "edit", "99", "x"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NOTES_FILE: file },
      encoding: "utf8",
    });
    assert.strictEqual(out.trim(), "No note #99 found");
  });
});

test("notes edit rejects empty text and does not change the note", () => {
  withTempStore(seed, (file) => {
    const out = execFileSync(process.execPath, ["notes.js", "edit", "1"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, NOTES_FILE: file },
      encoding: "utf8",
    });
    assert.match(out, /Usage: notes edit/);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, "utf8")), seed);
  });
});
