/**
 * The facade does one thing: assemble the four packages and bind the
 * injections. So there are two things to check, and only two.
 *
 * That what it hands back is really the packages' own — not a copy, not a
 * wrapper that has drifted. Identity comparisons, against the real packages.
 *
 * And that the injections land: `show.play` must receive `{ Tone, io, sound }`
 * without the call site naming them. That one cannot be observed through the
 * real `show`, which needs a DOM and an AudioContext to get far enough to
 * fail informatively, so it is observed through a recording stand-in — which
 * is the same `options.show` a contributor uses to develop against a working
 * copy, and therefore worth testing in its own right.
 */

import { test } from "node:test";
import assert from "node:assert";
import studio, { VERSION, TONE_VERSION } from "../src/index.js";
import packages from "./helpers/local.mjs";

const { algo, io, show, sound } = packages;

/** Tone is never loaded here: these tests make no network calls. */
const Tone = { __fake: "Tone" };

/** Everything supplied, so nothing resolves by URL. */
function local(extra = {}) {
  return studio({ algo, io, show, sound, Tone, ...extra });
}

const piece = {
  tempo: 120,
  tracks: [{
    label: "Scale",
    notes: [
      { pitch: 60, duration: 1, time: 0, velocity: 0.8 },
      { pitch: 62, duration: 1, time: 1, velocity: 0.8 },
      { pitch: 64, duration: 2, time: 2, velocity: 0.8 },
    ],
  }],
};

// ---------------------------------------------------------------- the surface

test("every name it exposes is defined", async () => {
  const jm = await local();
  const missing = Object.entries(jm)
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  assert.deepEqual(missing, [],
    `undefined on the facade: ${missing.join(", ")}. A name that misses its ` +
    `package captures undefined once and stays undefined forever.`);
});

test("VERSION is the package's own, not a package it fronts", async () => {
  const jm = await local();
  assert.equal(typeof VERSION, "string");
  assert.equal(jm.VERSION, VERSION);
  assert.notEqual(jm.VERSION, algo.VERSION);
});

test("TONE_VERSION is the version the packages are verified against", () => {
  // Tone 15 moved enough of the internals that both the glissando resampling
  // and the sustain looping feature-detect their way to `false` — silently.
  // The fallback URL pins this; the constant is what the README quotes.
  assert.match(TONE_VERSION, /^14\./);
});

// -------------------------------------------------------------------- passing
// through: what it hands back is the package's own object, not a copy

test("composing is algo's, by identity", async () => {
  const jm = await local();
  for (const name of ["theory", "generative", "processors", "analysis", "constants"]) {
    assert.equal(jm[name], algo[name], `jm.${name} is not algo.${name}`);
  }
  assert.equal(jm.utils, algo.utils);
  assert.equal(jm.algo, algo);
});

test("writing out is io's, by identity", async () => {
  const jm = await local();
  for (const name of [
    "midi", "midiBytes", "midiBase64", "midiPlayer", "midiDisplay",
    "midiToJmon", "parseMidiFile", "musicxml", "downloadMusicXML",
    "validate", "format",
  ]) {
    assert.equal(jm[name], io[name], `jm.${name} is not io.${name}`);
  }
  assert.equal(jm.io, io);
});

test("instruments is sound itself", async () => {
  const jm = await local();
  assert.equal(jm.instruments, sound);
  assert.equal(jm.sound, sound);
  assert.equal(typeof jm.instruments.create, "function");
});

test("master is show's, and the players are wrappers rather than passthroughs", async () => {
  const jm = await local();
  assert.equal(jm.master, show.master);
  assert.equal(jm.show, show);
  // These four differ from show's by design: they carry the bound injections.
  for (const name of ["play", "score", "scoreSVG", "wav"]) {
    assert.equal(typeof jm[name], "function");
    assert.notEqual(jm[name], show[name], `jm.${name} would pass no injections`);
  }
});

// ----------------------------------------------------------- through to work
// the passed-through functions still do their job

test("jm.key builds a scale through algo", async () => {
  const jm = await local();
  const notes = jm.key("C", "major").scale({ start: 60, length: 8 });
  assert.equal(notes.length, 8);
  assert.equal(notes[0], 60);
});

test("jm.midi writes a real Standard MIDI File", async () => {
  const jm = await local();
  const bytes = jm.midi(piece);          // headless: returns the bytes
  assert.ok(bytes.length > 0);
  assert.deepEqual([...bytes.slice(0, 4)], [0x4d, 0x54, 0x68, 0x64]); // "MThd"
});

test("jm.validate reads a piece through io", async () => {
  const jm = await local();
  const result = jm.validate(piece);
  assert.ok(result, "validate returned nothing");
  // It is a method on io's object literal; if it were rebound it would lose
  // `this` — it does not use `this`, and this is what says so.
  assert.doesNotThrow(() => jm.validate(piece));
});

// -------------------------------------------------------------- the injections

/** A `show` that records what it was given instead of playing it. */
function recordingShow() {
  const calls = [];
  const record = (name) => (piece, options) => {
    calls.push({ name, piece, options });
    return `${name}:ok`;
  };
  return {
    calls,
    play: record("play"),
    score: record("score"),
    scoreSVG: record("scoreSVG"),
    wav: record("wav"),
    master: show.master,
  };
}

test("play and wav arrive with Tone, io and sound bound", async () => {
  const spy = recordingShow();
  const jm = await studio({ algo, io, show: spy, sound, Tone });

  assert.equal(jm.play(piece), "play:ok");
  assert.equal(jm.wav(piece), "wav:ok");

  for (const call of spy.calls) {
    assert.equal(call.piece, piece);
    assert.equal(call.options.Tone, Tone, `${call.name} lost Tone`);
    assert.equal(call.options.io, io, `${call.name} lost io`);
    assert.equal(call.options.sound, sound, `${call.name} lost sound`);
  }
});

test("score and scoreSVG arrive with io and Verovio bound", async () => {
  const spy = recordingShow();
  const verovio = { __fake: "verovio" };
  const VerovioToolkit = { __fake: "toolkit" };
  const jm = await studio({ algo, io, show: spy, sound, Tone, verovio, VerovioToolkit });

  jm.score(piece);
  jm.scoreSVG(piece);

  for (const call of spy.calls) {
    assert.equal(call.options.io, io, `${call.name} lost io`);
    assert.equal(call.options.verovio, verovio);
    assert.equal(call.options.VerovioToolkit, VerovioToolkit);
  }
});

test("a call-site option wins over the bound one", async () => {
  const spy = recordingShow();
  const jm = await studio({ algo, io, show: spy, sound, Tone });
  const otherTone = { __fake: "other" };

  jm.play(piece, { autoplay: true, Tone: otherTone });

  const [{ options }] = spy.calls;
  assert.equal(options.autoplay, true, "the extra option was dropped");
  assert.equal(options.Tone, otherTone, "the bound Tone shadowed the given one");
  assert.equal(options.io, io, "overriding one injection dropped the others");
});

test("supplying a package overrides the CDN copy", async () => {
  // Nothing resolves by URL in these tests, which is only true because every
  // package is supplied. If `resolve` ever preferred its own copy, this would
  // reach the network and fail under Node.
  const mine = { ...algo, theory: { __mine: true } };
  const jm = await studio({ algo: mine, io, show, sound, Tone });
  assert.equal(jm.algo, mine);
  assert.deepEqual(jm.theory, { __mine: true });
});

// --------------------------------------------------------------------- Tone

test("audio: false skips Tone entirely", async () => {
  // The path a script takes when it only writes files: no AudioContext, and
  // no attempt to fetch Tone, which under Node would throw on the URL import.
  const before = globalThis.Tone;
  delete globalThis.Tone;
  try {
    const jm = await studio({ algo, io, show, sound, audio: false });
    assert.equal(jm.Tone, null);
    assert.equal(globalThis.Tone, undefined, "it published a Tone it never loaded");
    // Everything that does not need audio still works.
    assert.deepEqual([...jm.midi(piece).slice(0, 4)], [0x4d, 0x54, 0x68, 0x64]);
  } finally {
    if (before === undefined) delete globalThis.Tone; else globalThis.Tone = before;
  }
});

test("a supplied Tone is published, so a notebook's own cell finds the same one", async () => {
  // Two copies of Tone means two AudioContexts, and a node from one will not
  // connect to the other.
  const before = globalThis.Tone;
  delete globalThis.Tone;
  try {
    const jm = await studio({ algo, io, show, sound, Tone });
    assert.equal(jm.Tone, Tone);
    assert.equal(globalThis.Tone, Tone);
  } finally {
    if (before === undefined) delete globalThis.Tone; else globalThis.Tone = before;
  }
});

test("a Tone already on globalThis is reused rather than replaced", async () => {
  const before = globalThis.Tone;
  const existing = { __fake: "already here" };
  globalThis.Tone = existing;
  try {
    const jm = await studio({ algo, io, show, sound });
    assert.equal(jm.Tone, existing, "it loaded a second Tone over the notebook's");
    assert.equal(globalThis.Tone, existing);
  } finally {
    if (before === undefined) delete globalThis.Tone; else globalThis.Tone = before;
  }
});

test("a supplied Tone does not evict one already on globalThis", async () => {
  // Whoever got there first owns the AudioContext. The supplied one is still
  // what this facade uses, and the caller asked for that explicitly.
  const before = globalThis.Tone;
  const existing = { __fake: "already here" };
  globalThis.Tone = existing;
  try {
    const jm = await studio({ algo, io, show, sound, Tone });
    assert.equal(jm.Tone, Tone);
    assert.equal(globalThis.Tone, existing);
  } finally {
    if (before === undefined) delete globalThis.Tone; else globalThis.Tone = before;
  }
});

// ------------------------------------------------------------------- no logic

test("it holds no logic of its own", async () => {
  // The whole point: a facade that computes something will drift away from
  // the packages it fronts. Nothing here but delegation, so the source stays
  // small enough to read in one sitting.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
    .replace(/^\s*\/\/.*$/gm, "")       // line comments
    .split("\n")
    .filter((line) => line.trim().length > 0);
  assert.ok(code.length < 80,
    `${code.length} lines of code. Anything past delegation belongs in a package.`);
});
