// load_story.js — assemble the story from per-episode files (build-free).
//
// Content lives in web/data/story/<ep>.json (one { nodes:[…] } per episode) +
// meta.json ({ episodes:[…], defaults, backgrounds, review }). At load time the
// episode node arrays are concatenated IN ORDER into a single script, and labels
// are recomputed from the actual node positions (authoritative — never stale).
//
// To grow content: edit the relevant episode file, or add a new file + a meta
// entry. No build step; the browser fetches and concatenates.

export function assembleStory(meta, episodeNodeArrays) {
  const nodes = [].concat(...episodeNodeArrays);
  const labels = {};
  nodes.forEach((n, i) => { if (n && n.op === 'label') labels[n.name] = i; });
  return {
    nodes,
    labels,
    defaults: meta.defaults || {},
    backgrounds: meta.backgrounds || {},
    review: meta.review,
  };
}

export async function loadStory(base = 'data/story') {
  const meta = await fetch(base + '/meta.json').then(r => r.json());
  const eps = await Promise.all(
    meta.episodes.map(f => fetch(base + '/' + f).then(r => r.json()))
  );
  return assembleStory(meta, eps.map(e => (e && e.nodes) || []));
}
