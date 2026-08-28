# `dapi render <id>`

Alias: `dapi export`.

Renders a scene through the same capture world and MediaBunny encoder as the
desktop **Export** command. Output is streamed through the Electron main
process to an ordinary filesystem path, so large renders are not buffered in
the CLI process.

## Input

- `<id>`: scene id, or `file:id` when two source files use the same id
- `-o, --output <path>`: output file (default `<scene-id>.<format>` in the current directory)
- `-f, --format <format>`: `mp4`, `webm`, `ogg`, or `mov` (default `mp4`)
- `-r, --resolution <pixels>`: output height
- `--fps <fps>`: output frame rate
- `--video-codec <codec>`: `avc`, `hevc`, `vp9`, `av1`, or `vp8`
- `--video-bitrate <bps>`: video bitrate
- `--no-audio`: disable audio encoding
- `--audio-codec <codec>`: `aac` or `opus`
- `--audio-bitrate <bps>`: audio bitrate
- `--sample-rate <hz>`: audio sample rate

The codecs a particular Windows machine can encode depend on Chromium,
WebCodecs, and the installed GPU driver. MP4/AVC with AAC is the standard
desktop preset.

## Output

One JSON object after the encoder has closed the output successfully:

```ts
{ path: string; format: "mp4" | "webm" | "ogg" | "mov" }
```

The path is absolute. A successful response means the file was written; use
`dapi media probe <path>` to verify its duration and tracks.

## Example

```powershell
dapi render intro --output .\intro.mp4 --resolution 1080 --fps 30
dapi media probe .\intro.mp4
```

