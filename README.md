# jmon/studio

The four JMON packages, assembled.

```js
import studio from "https://cdn.jsdelivr.net/gh/jmonlabs/studio@main/src/index.js";
const jm = await studio();
```

That is the whole setup. Tone.js and Verovio load on their own, at the
versions the packages are verified against.

```js
const notes = jm.key("C", "major").scale().generate({ start: 60, length: 8 });

const piece = {
  tempo: 120,
  tracks: [{
    label: "Scale",
    synth: 40,
    notes: notes.map((pitch, i) => ({ pitch, duration: 1, time: i, velocity: 0.8 })),
  }],
};

jm.play(piece);           // a player
jm.midi(piece);           // a .mid download link

// These two render before they can hand back anything, so both are promises.
await jm.score(piece);    // engraved
await jm.wav(piece);      // a .wav download link, after an offline render
```

## What is behind it

| | |
|---|---|
| [`jmon/algo`](https://github.com/jmonlabs/algo) | `jm.key`, `jm.theory`, `jm.generative`, `jm.processors`, `jm.analysis`, `jm.utils` |
| [`jmon/show`](https://github.com/jmonlabs/show) | `jm.play`, `jm.score`, `jm.scoreSVG`, `jm.wav`, `jm.master` |
| [`jmon/io`](https://github.com/jmonlabs/io) | `jm.midi`, `jm.midiBytes`, `jm.midiBase64`, `jm.midiPlayer`, `jm.midiDisplay`, `jm.midiToJmon`, `jm.parseMidiFile`, `jm.musicxml`, `jm.validate`, `jm.format` |
| [`jmon/sound`](https://github.com/jmonlabs/sound) | `jm.instruments` |

Each is also there whole, as `jm.algo`, `jm.show`, `jm.io` and `jm.sound`, for
anything the surface above leaves out.

## The JMON format

```js
// A note. Rests are `pitch: null`, chords are `pitch: [60, 64, 67]`.
{ pitch: 60, duration: 1, time: 0, velocity: 0.8 }

// A piece. Times are in quarter notes.
{
  tempo: 120,
  tracks: [{ label: "Melody", synth: 40, notes: [...] }],
}
```

## Options

```js
await studio({
  ref: "v1.0.0",   // one git ref for all four. `main` while iterating.
  audio: false,    // skip Tone, for a script that only writes files
  Tone,            // your own handles, if you loaded them yourself
  verovio,
  VerovioToolkit,
  algo,            // a working copy of any package, in place of the CDN one
});
```

If you load Tone yourself, pin it:

```js
import * as Tone from "https://cdn.jsdelivr.net/npm/tone@14.8.49/+esm";
const jm = await studio({ Tone });
```

Unpinned, `esm.sh/tone` serves 15.x. Sampled instruments still play, but
bending a note by resampling and holding one past the end of its sample both
reach into `Tone.Sampler` internals that moved in 15, and both are
feature-detected, so they turn themselves off without saying so.

`studio()` reuses `globalThis.Tone` when a cell has already loaded it, and
publishes what it loads when none is there. Two copies of Tone means two
AudioContexts, and a node from one will not connect to the other.

## Node

Node refuses `https://` imports, so this package does not run there. Import
the four directly instead, from a checkout, and pass the injections
yourself:

```js
show.play(piece, { Tone, io, sound });
io.midi(piece);
```

## Tests

```bash
git clone https://github.com/jmonlabs/algo ../algo
git clone https://github.com/jmonlabs/io ../io
git clone https://github.com/jmonlabs/show ../show
git clone https://github.com/jmonlabs/sound ../sound

node --test tests/*.test.js
```

19 tests against the real packages, nothing to install and no network.

## License

GPL-3.0-or-later
