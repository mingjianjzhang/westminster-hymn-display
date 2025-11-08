# Hymn Projector

Hymn Projector is a simple web application for presenting bilingual hymns during meetings or services. It loads plain-text hymn files (with English and Chinese lines) and automatically splits each stanza across slides so that the display stays readable on any screen. A control panel lets you choose hymns, browse the generated slides, and send synchronized updates to the display view.

## Features
- Loads `.hymn` files stored under `public/hymns/`
- Automatically interleaves English and Chinese lines and limits each slide to 8 total lines (4 English + 4 Chinese) by collating stanza text
- Preserves the author-provided stanza order, including hymns that cycle across multiple distinct choruses
- Control screen for selecting hymns, adjusting modes, and triggering slides
- Display screen shows hymn title, bilingual lyrics, and stanza progress indicator

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
