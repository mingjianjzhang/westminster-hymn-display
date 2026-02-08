# Hymn Projector

Hymn Projector is a simple web application for presenting bilingual hymns during meetings or services. It loads plain-text hymn files (with English and Chinese lines) and automatically splits each stanza across slides so that the display stays readable on any screen. A control panel lets you choose hymns, browse the generated slides, and send synchronized updates to the display view.

## Features
- Loads `.hymn` files stored under `public/hymns/`
- Automatically interleaves English and Chinese lines and limits each slide to 8 total lines (4 English + 4 Chinese) by collating stanza text
- Preserves the author-provided stanza order, including hymns that cycle across multiple distinct choruses
- Control screen for selecting hymns, adjusting modes, and triggering slides
- Display screen shows hymn title, bilingual lyrics, and stanza progress indicator

## Run on Windows (non‑technical steps)
1) Install Node.js (includes npm). Visit <https://nodejs.org/en>, download the “LTS” Windows installer, and click through the defaults. After installation finishes, close and reopen any Command Prompt windows.  
2) Get the project files. On the project’s GitHub page, click “Code” → “Download ZIP”. Right‑click the downloaded file and choose “Extract All…” into a folder you can find easily (e.g., `C:\HymnProjector`).  
3) Open a Command Prompt in that folder. In File Explorer, open the extracted folder, click the address bar, type `cmd`, and press Enter. A black window will open already pointing at the project.  
4) Install the app’s dependencies (only once): in that Command Prompt, type `npm install` and press Enter. Wait until it says done with no errors.  
5) Start the app: type `npm run dev` and press Enter. When it finishes starting, it will show a “Local” URL such as `http://localhost:5173/`.  
6) View and use the projector. Open that URL in your browser (Chrome, Edge, or Firefox). To mirror to a projector, open a second browser window on the projector screen and paste the same URL, then choose the display mode within the app’s controls.  
7) When you’re finished, go back to the Command Prompt and press `Ctrl + C` to stop the app.

## Run on macOS (double‑click launcher)
1) Install Node.js (includes npm). Visit <https://nodejs.org/en>, download the “LTS” macOS installer, and click through the defaults.  
2) Get the project files. On the project’s GitHub page, click “Code” → “Download ZIP”. Double‑click the ZIP to extract it somewhere easy (e.g., `~/HymnProjector`).  
3) In Finder, open the extracted folder and double‑click `start-hymn-projector.command`.  
4) If macOS warns about the file, right‑click it, choose “Open”, then confirm.  
5) The Terminal window will show a local URL such as `http://localhost:5173/`. Open that URL in your browser.  
6) When you’re finished, return to the Terminal window and press `Ctrl + C`, then hit Enter to close the window.

## Processing hymn indexes
Use `scripts/process_hymns.py` to keep the hymn sources tidy:

- `python3 scripts/process_hymns.py public/index/101-200` — sanitize an index file in place
- `python3 scripts/process_hymns.py public/index/101-200 --generate` — sanitize and emit fresh `.hymn` files (defaults to `public/hymns/`)
- Add `--prefix-number` when generating to include the hymn/CCLI number in each filename (helpful when you want to keep prior versions untouched)
- `python3 scripts/process_hymns.py --reformat-hymns` — reformat every existing `.hymn` file so each stanza stays within four lines per language

The script always applies the line-collation rule during generation and reformatting, so future hymn batches automatically fit on a single slide per stanza.

## Missing / To-Verify Hymns
- Hymn 283 — source text not yet available
- Hymn 129 — contains two extra Chinese stanzas that do not have English counterparts (needs review)
- Hymns 194, 219, 237, 240, 243, 436 — now render with their multiple choruses, but keep an eye out for any transcription mistakes as more source PDFs get ingested
- Enhancement idea: some hymns (e.g., around #340) have five-line choruses where the last line repeats; consider adding support so the full chorus fits on one slide without manual editing
- Hymn 328 - no English text


1920x1080

