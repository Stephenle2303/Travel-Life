const fs = require('node:fs');
const path = require('node:path');
const { decode } = require('jpeg-js');
const ts = require('typescript');

const featureFile = path.join(__dirname, '../src/visual-place/landmark-embedding.ts');
const compiled = { exports: {} };
const { outputText } = ts.transpileModule(fs.readFileSync(featureFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
new Function('exports', 'require', outputText)(compiled.exports, require);
const { prepareLandmarkPixels, landmarkImageSize: size, summarizeLandmarkTensor, scoreLandmarkEmbedding, matchesLandmarkEmbedding } = compiled.exports;

function readReference(filename, rotateClockwise = false, portrait = false) {
  const original = decode(fs.readFileSync(filename), { useTArray: true });
  const width = rotateClockwise ? original.height : original.width;
  const height = rotateClockwise ? original.width : original.height;
  const viewWidth = portrait ? Math.min(width, height * 0.8) : width;
  function sample(row, column, channel) {
    const offset = rotateClockwise ? (original.height - 1 - column) * original.width + row : row * original.width + column;
    return original.data[offset * 4 + channel];
  }
  const resized = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    const y = (row + 0.5) * height / size - 0.5;
    const top = Math.max(0, Math.floor(y));
    const bottom = Math.min(top + 1, height - 1);
    const vertical = Math.max(0, y - top);
    for (let column = 0; column < size; column++) {
      const x = (column + 0.5) * viewWidth / size - 0.5 + (width - viewWidth) / 2;
      const left = Math.max(0, Math.floor(x));
      const right = Math.min(left + 1, width - 1);
      const horizontal = Math.max(0, x - left);
      const destination = (row * size + column) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const upper = sample(top, left, channel) * (1 - horizontal) + sample(top, right, channel) * horizontal;
        const lower = sample(bottom, left, channel) * (1 - horizontal) + sample(bottom, right, channel) * horizontal;
        resized[destination + channel] = Math.round(upper * (1 - vertical) + lower * vertical);
      }
      resized[destination + 3] = 255;
    }
  }
  return prepareLandmarkPixels(resized);
}

const [directory, ...options] = process.argv.slice(2);
if (!directory) throw new Error('Pass the directory containing the public originals listed in LANDMARKS.md.');
const defaultSources = [
  'campus-eckert.jpg', 'campus-bolz.jpg', 'campus-bolz-other.jpg', 'campus-hdb.jpg',
  'campus-wong1.jpg', 'campus-wong2.jpg', 'campus-pfeiffer.jpg',
].map((source) => ({
  source, placeId: 'ewha-campus-visual',
  kind: source === 'campus-pfeiffer.jpg' ? 'pfeiffer-hall' : 'campus-complex',
  rotateClockwise: source === 'campus-hdb.jpg',
}));
const sourcesOption = options.find((argument) => argument.startsWith('--sources='));
const checkOnly = options.includes('--check-only');
const validationFiles = options.filter((argument) => !argument.startsWith('--'));
const sources = sourcesOption ? JSON.parse(fs.readFileSync(sourcesOption.slice('--sources='.length), 'utf8')) : defaultSources;
const jpegName = /^[\w.-]+\.jpe?g$/i;
if (!Array.isArray(sources) || !sources.length || sources.some((entry) =>
  !entry || typeof entry.source !== 'string' || !jpegName.test(entry.source)
    || typeof entry.placeId !== 'string' || !/^[a-z0-9-]+$/.test(entry.placeId)
    || !['campus-complex', 'pfeiffer-hall'].includes(entry.kind)
    || (entry.rotateClockwise !== undefined && typeof entry.rotateClockwise !== 'boolean'))
  || new Set(sources.map((entry) => entry.source)).size !== sources.length
  || validationFiles.some((file) => !jpegName.test(file) || sources.some((entry) => entry.source === file))) {
  throw new Error('Use unique public JPEG sources and disjoint validation filenames.');
}
async function main() {
  const { InferenceSession, Tensor } = require(path.resolve(directory, 'onnx-runtime/node_modules/onnxruntime-node'));
  const model = path.join(__dirname, '../assets/models/dinov2-small-int8.onnx');
  const session = await InferenceSession.create(model, { intraOpNumThreads: 2, interOpNumThreads: 1 });
  const embed = async (source, portrait = false, rotateClockwise = false) => {
    const pixels = readReference(path.join(directory, source), rotateClockwise, portrait);
    const { last_hidden_state: output } = await session.run({ pixel_values: new Tensor('float32', pixels, [1, 3, size, size]) });
    const result = summarizeLandmarkTensor(output.data, output.dims);
    if (!result) throw new Error('Unexpected model output.');
    return result;
  };
  const round = (vector) => Array.from(vector, (value) => Number(value.toFixed(5)));
  const references = [];
  for (const { source, placeId, kind, rotateClockwise } of sources) {
    for (const portrait of [false, true]) {
      const { global, pooled, regions } = await embed(source, portrait, rotateClockwise);
      references.push({ source, placeId, kind, portrait, embedding: { global: round(global), pooled: round(pooled), regions: regions.map(round) } });
    }
  }
  for (const filename of validationFiles) {
    const query = await embed(filename);
    const matches = references.filter(({ embedding, kind }) => matchesLandmarkEmbedding(query, embedding, kind));
    const best = references.map(({ source, embedding }) => ({ source, ...scoreLandmarkEmbedding(query, embedding) }))
      .sort((left, right) => right.global - left.global)[0];
    console.log(filename, [...new Set(matches.map(({ placeId }) => placeId))], best);
  }
  if (!checkOnly) {
    const target = path.join(__dirname, '../src/visual-place/data/ewha-campus-embeddings.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(references) + '\n');
  }
  await session.release();
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
