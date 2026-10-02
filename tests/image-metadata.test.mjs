import test from 'node:test';
import assert from 'node:assert/strict';

import { headHtml, photoNode } from '../src/lib/seo.js';

const graph = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'));
const images = (node, out = []) => {
  if (Array.isArray(node)) node.forEach((n) => images(n, out));
  else if (node && typeof node === 'object') {
    if (node['@type'] === 'ImageObject') out.push(node);
    Object.values(node).forEach((v) => images(v, out));
  }
  return out;
};
const photo = { sha256: 'abc', width: 800, height: 1000, derivatives: true, author: 'Bryan Berlin', licence: 'CC BY-SA 4.0', licence_url: 'https://creativecommons.org/licenses/by-sa/4.0', source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', attribution: 'Bryan Berlin, CC BY-SA 4.0' };
const route = (og) => ({ fullTitle: 'T', description: 'd', indexable: true, og });

test('logo and default card are PropBetEdge art', () => {
  const nodes = images(graph(headHtml('/', route(null))));
  assert.equal(nodes.length, 2);
  for (const n of nodes) {
    assert.deepEqual(n.creator, { '@type': 'Organization', name: 'PropBetEdge' });
    assert.equal(n.copyrightNotice, '© 2026 PropBetEdge');
  }
});

test('Commons photo node credits the photographer, never PropBetEdge', () => {
  const n = photoNode('x#photo', photo, 'Scottie Scheffler');
  assert.deepEqual(n.creator, { '@type': 'Person', name: 'Bryan Berlin' });
  assert.equal(n.copyrightNotice, 'Bryan Berlin / CC BY-SA 4.0');
  assert.equal(n.license, photo.licence_url);
  assert.equal(n.acquireLicensePage, photo.source_url);
  assert.equal(n['@id'], 'x#photo');
});

test('photo without a recorded author is held', () => {
  const n = photoNode('x#photo', { ...photo, author: null }, 'X');
  assert.equal(n.creator, undefined);
  assert.equal(n.copyrightNotice, undefined);
});

test('generated card credits the photo it composites; text-only card is owned', () => {
  const og = { url: 'https://golf.propbetedge.ai/og/player/x.png', width: 1200, height: 630, alt: 'X' };
  const withPhoto = images(graph(headHtml('/player/x', route({ ...og, photos: [photo] })))).find((n) => n.url === og.url);
  assert.equal(withPhoto.creator.name, 'PropBetEdge');
  assert.equal(withPhoto.copyrightNotice, '© 2026 PropBetEdge. Photo: Bryan Berlin / CC BY-SA 4.0');
  assert.equal(withPhoto.license, photo.licence_url);
  const textOnly = images(graph(headHtml('/player/x', route({ ...og, photos: [null] })))).find((n) => n.url === og.url);
  assert.equal(textOnly.copyrightNotice, '© 2026 PropBetEdge');
  const matchup = images(graph(headHtml('/m', route({ ...og, photos: [photo, { ...photo, author: 'Keith Allison', licence: 'CC BY-SA 2.0', licence_url: 'https://creativecommons.org/licenses/by-sa/2.0' }] })))).find((n) => n.url === og.url);
  assert.equal(matchup.copyrightNotice, '© 2026 PropBetEdge. Photos: Bryan Berlin / CC BY-SA 4.0; Keith Allison / CC BY-SA 2.0');
  assert.equal(matchup.license, undefined); // two different SA licences: no single licence asserted
  const uncredited = images(graph(headHtml('/player/x', route({ ...og, photos: [{ ...photo, author: '' }] })))).find((n) => n.url === og.url);
  assert.equal(uncredited.creator, undefined);
});

test('Commons placeholder author ("... assumed") is a guess, so the photo is held', () => {
  const n = photoNode('x#photo', { ...photo, author: 'No machine-readable author provided. Markatty~commonswiki assumed (based on copyright claims).', licence: 'Public domain' }, 'X');
  assert.equal(n.creator, undefined);
  assert.equal(n.copyrightNotice, undefined);
});
