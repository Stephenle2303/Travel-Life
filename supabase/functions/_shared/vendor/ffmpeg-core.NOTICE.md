# Pinned decoder factory

`ffmpeg-core.mjs` is the unchanged ESM factory from `@ffmpeg/core` 0.12.10.
SHA-256: `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3`.
The WASM is fetched server-side only from the pinned jsDelivr package URL and must
match `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`.
The binary is not checked into this repository or delivered in the mobile app.

Upstream: https://github.com/ffmpegwasm/ffmpeg.wasm
Package: https://www.npmjs.com/package/@ffmpeg/core/v/0.12.10
Build source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main
Licensing: https://ffmpegwasm.netlify.app/docs/faq/#what-is-the-license-of-ffmpegwasm

The JavaScript wrapper is MIT licensed, copyright (c) 2019 Jerome Wu. FFmpeg core
and its compiled codec dependencies retain their own licenses, including FFmpeg
and external codec licensing; wrapper MIT metadata does not relicense those bytes.
Retain corresponding build/source/license records before redistributing any core
binary. This private server integration does not make a redistribution clearance
claim. Vendor internals contain default console fallbacks; production supplies
discarding print/printErr/logger/progress callbacks before any private input.

MIT License

Copyright (c) 2019 Jerome Wu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
