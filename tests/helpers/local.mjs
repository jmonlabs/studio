/**
 * The four packages, from sibling checkouts.
 *
 * `studio()` resolves them by URL, which Node refuses, so the tests supply
 * them instead — which is also the path a contributor uses to develop against
 * a working copy. Real packages rather than stubs: a stub would test the stub,
 * and the one thing this facade must get right is that the delegation lands.
 */
const NAMES = ["algo", "io", "show", "sound"];
const CANDIDATES = ["../../../", "../../../../"];

const packages = {};
for (const name of NAMES) {
  let loaded = null;
  for (const prefix of CANDIDATES) {
    try {
      const mod = await import(new URL(`${prefix}${name}/src/index.js`, import.meta.url).href);
      loaded = mod.default ?? mod;
      break;
    } catch { /* try the next */ }
  }
  if (!loaded) {
    throw new Error(
      `These tests need jmonlabs/${name} checked out beside this repo:\n` +
      `  git clone https://github.com/jmonlabs/${name} ../${name}`,
    );
  }
  packages[name] = loaded;
}

export default packages;
