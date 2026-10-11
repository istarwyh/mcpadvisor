// Static consistency checks for the installed prompt assets. These do not
// execute an LLM workflow or prove that an external sharding tool is safe.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFileSync(join(root, path), 'utf8');
const list = path => readdirSync(join(root, path));
const core = '.bmad-core';
const mirrors = '.claude/commands/BMad';
const agents = list(`${core}/agents`).filter(name => name.endsWith('.md'));

// Read the simple, fixed indentation of this asset format, not general YAML.
function dependencies(text) {
  const result = [];
  let category;
  for (const line of text.split('\ndependencies:\n')[1].split('\n')) {
    if (line === '```') break;
    const heading = line.match(/^ {2}(\w+):$/);
    if (heading) category = heading[1];
    const item = line.match(/^ {4}- ([\w.-]+)$/);
    if (item) result.push(`${category}/${item[1]}`);
  }
  return result;
}

function commandBlock(text) {
  return text.match(/^commands:.*\n([\s\S]*?)(?=^\S)/m)[1];
}

function commands(text) {
  return [
    ...commandBlock(text).matchAll(/^ {2}(?:- )?([\w-]+)(?: [^:]*)?:/gm),
  ].map(match => match[1]);
}

test('all installed Claude command bodies match their core source', () => {
  for (const category of ['agents', 'tasks']) {
    for (const name of list(`${mirrors}/${category}`)) {
      const mirror = read(`${mirrors}/${category}/${name}`);
      assert.equal(
        mirror.split('\n').slice(4).join('\n'),
        read(`${core}/${category}/${name}`),
        name,
      );
    }
  }
});

test('agent dependencies exist and command task references are declared', () => {
  for (const name of agents) {
    const text = read(`${core}/agents/${name}`);
    const deps = dependencies(text);
    for (const path of deps)
      assert.ok(existsSync(join(root, core, path)), `${name}: ${path}`);
    for (const match of commandBlock(text).matchAll(
      /\btask ([a-z]+(?:-[a-z]+)+)(?:\.md)?\b/g,
    )) {
      assert.ok(
        deps.includes(`tasks/${match[1]}.md`),
        `${name}: undeclared task ${match[1]}`,
      );
    }
    const examples = text.match(/^REQUEST-RESOLUTION:.*$/m)[0];
    for (const match of examples.matchAll(/\*([a-z][a-z-]*)/g)) {
      assert.ok(
        commands(text).includes(match[1]),
        `${name}: unknown example command ${match[1]}`,
      );
    }
  }
});

test('team agents and workflow dependencies resolve', () => {
  for (const name of list(`${core}/agent-teams`)) {
    const text = read(`${core}/agent-teams/${name}`);
    const agentsBlock = text.split('agents:\n')[1].split('workflows:')[0];
    for (const match of agentsBlock.matchAll(/^ {2}- ([\w-]+)$/gm)) {
      assert.ok(agents.includes(`${match[1]}.md`), `${name}: ${match[1]}`);
    }
    for (const match of text.matchAll(/^ {2}- ([\w-]+\.yaml)$/gm)) {
      assert.ok(
        existsSync(join(root, core, 'workflows', match[1])),
        `${name}: ${match[1]}`,
      );
    }
  }
});

test('manifest paths are unique, nonempty, and have current content hashes', () => {
  const seen = new Set();
  for (const match of read(`${core}/install-manifest.yaml`).matchAll(
    / {2}- path: (.+)\n {4}hash: ([0-9a-f]+)/g,
  )) {
    const [, path, hash] = match;
    assert.ok(!seen.has(path), `duplicate ${path}`);
    seen.add(path);
    assert.ok(statSync(join(root, path)).size > 0, `empty ${path}`);
    assert.equal(
      createHash('sha256')
        .update(readFileSync(join(root, path)))
        .digest('hex')
        .slice(0, 16),
      hash,
      path,
    );
  }
  assert.ok(seen.has(`${core}/user-guide.md`));
  assert.ok(!seen.has(`${core}/bmad-core/user-guide.md`));
});

test('story workflow discovers both filenames and uses the real YAML template', () => {
  const create = read(`${core}/tasks/create-next-story.md`);
  const validate = read(`${core}/tasks/validate-next-story.md`);
  assert.ok(create.includes('{epicNum}.{storyNum}.*.md'));
  assert.ok(create.includes('numerically, not lexicographically'));
  assert.ok(create.includes('{epicNum}.{storyNum}.{story_title_short}.md'));
  assert.ok(create.includes('reject an existing epic/story pair'));
  assert.ok(create.includes('Output Path Safety'));
  assert.ok(
    dependencies(read(`${core}/agents/sm.md`)).includes('tasks/create-doc.md'),
  );
  assert.ok(validate.includes('.bmad-core/templates/story-tmpl.yaml'));
  assert.ok(validate.includes('sections` recursively'));
  assert.ok(!validate.includes('story-tmpl.md'));
});

test('workflow story commands and template preference references are valid', () => {
  const smCommands = commands(read(`${core}/agents/sm.md`));
  for (const name of list(`${core}/workflows`)) {
    for (const match of read(`${core}/workflows/${name}`).matchAll(
      /@sm → \*([\w-]+)/g,
    )) {
      assert.ok(smCommands.includes(match[1]), `${name}: ${match[1]}`);
    }
  }
  for (const name of list(`${core}/templates`)) {
    for (const match of read(`${core}/templates/${name}`).matchAll(
      /\.bmad-core\/data\/[\w.-]+/g,
    )) {
      assert.ok(existsSync(join(root, match[0])), `${name}: ${match[0]}`);
    }
  }
});

test('document tasks retain explicit path and overwrite safety contracts', () => {
  const shard = read(`${core}/tasks/shard-doc.md`);
  const create = read(`${core}/tasks/create-doc.md`);
  for (const phrase of [
    'shell execution disabled',
    'separate arguments',
    'symlink',
    'overwrite',
    'YOLO mode',
  ]) {
    assert.ok(shard.includes(phrase), `shard-doc missing ${phrase}`);
  }
  assert.ok(!shard.includes('md-tree explode {input file}'));
  for (const phrase of [
    'Before substitution',
    'path components',
    'symlink',
    'Before every save',
    'YOLO mode',
  ]) {
    assert.ok(create.includes(phrase), `create-doc missing ${phrase}`);
  }
});
