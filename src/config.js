// iDICT public vocabulary. Refreshing reads the current release on main.
// For a fixed release, replace main with a verified tag or commit.
// Set manifestUrl to '' to use the local repository on loopback hosts.
export const vocabularyConfig = Object.freeze({
  manifestUrl: 'https://raw.githubusercontent.com/YourEducation/iDICT/main/manifest.json',
  repositoryUrl: 'https://github.com/YourEducation/iDICT',
  // Used ONLY on localhost / loopback. server.mjs maps the sibling data repository here.
  localManifestUrl: './vocabulary/manifest.json',
  timeoutMs: 30000
});
