# Fidji

A minimal, macOS-inspired notes app for Windows. Built with Electron and vanilla JavaScript — no frameworks, no cloud, no accounts. Your notes never leave your machine.

## Features

- **macOS-style interface** — frameless transparent window with rounded corners, traffic-light buttons, light and dark themes
- **Rich text editor** — headings, bold/italic/underline/strike, bullet and numbered lists, checklists, tables, alignment
- **Marker & eraser** — draw directly over your notes with adjustable size, opacity, softness and color
- **Photos on the page** — insert images and move, resize, rotate them anywhere in the note
- **Notes list** — search, pinning, drag-to-reorder, per-note undo history
- **Offline voice input** — speak and the text appears in your note. Language is detected automatically (whisper.cpp, ~100 languages). Works without internet after the first setup
- **Voice commands** — control the app with your voice (see below)
- **Translation panel** — translate selected text or the whole note (Google Translate with MyMemory fallback)
- **Password protection** — optional lock screen with scrypt-hashed password, local config only
- **Multilingual UI** — English and Russian, UTF-8 everywhere, automatic text direction (RTL/LTR)
- **Local storage only** — notes, images and drawings are stored in your user data folder as plain JSON and files

## Voice input

Press the microphone button in the toolbar, speak, press it again — the recognized text is inserted at the cursor position. While listening, the editor softly blurs behind a gradient veil and clears as soon as the first words arrive.

On first use Fidji downloads the whisper.cpp binaries and the `ggml-base` model (~140 MB) once. After that all recognition runs offline on your CPU.

### Voice commands

Say the trigger word **Fidji** followed by a command:

| Command | Action |
| --- | --- |
| Fidji new note | Create a new note |
| Fidji save | Save current note |
| Fidji delete note | Delete current note (with undo) |
| Fidji pin / unpin | Pin or unpin current note |
| Fidji find <word> | Search notes |
| Fidji translate | Open translation panel |
| Fidji theme | Toggle light / dark theme |
| Fidji stop | Stop listening |

Anything said without the trigger word is inserted into the note as plain text.

## Getting started

Requirements: Node.js 18+ and npm.

```bash
npm install
npm start