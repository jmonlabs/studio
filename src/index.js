/**
 * jmon/studio — one way in.
 *
 * The four packages are separate so they can be maintained separately, which
 * is right for the code and wrong for the hand: exporting to MIDI and
 * exporting to WAV are the same act, and they should not live in two
 * namespaces just because one needs an audio engine and the other does not.
 *
 * This assembles them and binds the injections once, so a call site says what
 * it does rather than where it comes from.
 *
 *     import studio from "https://cdn.jsdelivr.net/gh/jmonlabs/studio@main/src/index.js";
 *     const jm = await studio();
 *
 *     const scale = new jm.theory.harmony.Scale({ tonic: "C", mode: "major" })
 *       .generate({ length: 8 });
 *
 *     jm.play(piece);
 *     jm.score(piece);
 *     jm.midi(piece);
 *     jm.wav(piece);
 *
 * It holds no logic of its own. Everything here is delegation, which is what
 * keeps it from drifting away from the packages it fronts.
 *
 * Browsers and Deno only, since it resolves the packages by URL. Node refuses
 * `https://` imports, so a Node caller composes the four directly — which is
 * the audience that wants them separate anyway.
 *
 * @license GPL-3.0-or-later
 */

export const VERSION = "1.0.0";

/** The Tone.js the packages are written and verified against. */
export const TONE_VERSION = "14.8.49";

const CDN = "https://cdn.jsdelivr.net/gh/jmonlabs";
const PACKAGES = ["algo", "io", "show", "sound"];

/**
 * Load one package, unless the caller supplied it.
 *
 * Supplying it is how you develop against a working copy, and how the tests
 * run under Node at all.
 */
async function resolve(name, supplied, ref) {
  if (supplied) return supplied;
  const mod = await import(`${CDN}/${name}@${ref}/src/index.js`);
  return mod.default ?? mod;
}

/**
 * Find Tone.js, and leave it findable.
 *
 * A notebook often imports Tone in its own cell as well. Two copies means two
 * AudioContexts, and nodes from one will not connect to the other, so this
 * reuses `globalThis.Tone` when it is already there and publishes what it
 * loads when it is not.
 */
async function resolveTone(supplied) {
  if (supplied) {
    globalThis.Tone = globalThis.Tone ?? supplied;
    return supplied;
  }
  if (globalThis.Tone) return globalThis.Tone;

  const Tone = await import(`https://cdn.jsdelivr.net/npm/tone@${TONE_VERSION}/+esm`);
  globalThis.Tone = Tone;
  return Tone;
}

/**
 * Assemble the packages into one object.
 *
 * @param {Object} [options]
 * @param {string} [options.ref="main"] - Git ref for all four packages at
 *   once: a tag for stable work, `main` while iterating
 * @param {Object} [options.Tone] - Tone.js, if you want the handle yourself
 * @param {Object} [options.verovio] - Verovio module factory, for scores
 * @param {Object} [options.VerovioToolkit] - and its toolkit class
 * @param {Object} [options.algo] - a package, to override the CDN copy
 * @param {Object} [options.io]
 * @param {Object} [options.show]
 * @param {Object} [options.sound]
 * @param {boolean} [options.audio=true] - Load Tone. `false` skips it, for a
 *   headless script that only writes files
 * @returns {Promise<Object>} Everything, with the injections already bound
 */
export default async function studio(options = {}) {
  const { ref = "main", verovio, VerovioToolkit, audio = true } = options;

  const [algo, io, show, sound] = await Promise.all(
    PACKAGES.map((name) => resolve(name, options[name], ref)),
  );

  const Tone = audio ? await resolveTone(options.Tone) : null;

  // What `show` needs at every call. Bound once here so a call site does not
  // repeat it.
  const audioDeps = { Tone, io, sound };
  const scoreDeps = { io, verovio, VerovioToolkit };

  return {
    VERSION,

    // Composing — algo's whole surface, unchanged.
    key: algo.key,
    theory: algo.theory,
    generative: algo.generative,
    processors: algo.processors,
    analysis: algo.analysis,
    constants: algo.constants,
    utils: algo.utils,

    // Hearing and seeing.
    play: (piece, extra = {}) => show.play(piece, { ...audioDeps, ...extra }),
    score: (piece, extra = {}) => show.score(piece, { ...scoreDeps, ...extra }),
    scoreSVG: (piece, extra = {}) => show.scoreSVG(piece, { ...scoreDeps, ...extra }),
    wav: (piece, extra = {}) => show.wav(piece, { ...audioDeps, ...extra }),
    master: show.master,

    // Writing out, and reading back. Pure data: no audio, no DOM.
    midi: io.midi,
    midiBytes: io.midiBytes,
    midiBase64: io.midiBase64,
    midiPlayer: io.midiPlayer,
    midiDisplay: io.midiDisplay,
    midiToJmon: io.midiToJmon,
    parseMidiFile: io.parseMidiFile,
    musicxml: io.musicxml,
    downloadMusicXML: io.downloadMusicXML,
    validate: io.validate,
    format: io.format,

    // Instruments.
    instruments: sound,

    // The packages themselves, for anything this facade does not cover. It
    // fronts them rather than hiding them.
    algo,
    io,
    show,
    sound,
    Tone,
  };
}

export { studio };
