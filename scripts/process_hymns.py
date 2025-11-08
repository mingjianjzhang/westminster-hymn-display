#!/usr/bin/env python3
"""Sanitize hymn index files and regenerate .hymn files."""
import argparse
import pathlib
import re
from typing import List, Dict, Optional

METADATA_TOKENS = ('赞美和敬拜', 'Praise and Worship')
CHORUS_TOKENS_EN = ('chorus', '(c)', 'c)')
CHORUS_TOKENS_CN = ('和', '副歌')
METER_REGEX = re.compile(r'^\s*\d+(?:\.\d+)*(?:\.\s*[A-Za-z\u4e00-\u9fff().-]+)?\.?\s*$')
HEADER_REGEX = re.compile(r'^(\d{3})\s+(.+)$')
SECTION_HEADER_REGEX = re.compile(r'^(Verse\s+\S+|Chorus)\s+(English|Chinese):$')
SECTION_MARKERS = ('──', '——', '--', ' — ', ' - ')
PUNCTUATION_CHARS = set(',.;!?，。！？：；、。…“”"\'`')


def collapse_lines(lines: List[str], lang: str, max_lines: int = 4) -> List[str]:
    """Combine adjacent lyric lines until at most max_lines remain."""
    normalized = [ln.strip() for ln in lines if ln.strip()]
    if not normalized:
        return []

    def join(a: str, b: str) -> str:
        joiner = '' if lang == 'cn' else ' '
        if a.endswith(('—', '-')):
            joiner = ''
        return f"{a.rstrip()}{joiner}{b.lstrip()}"

    while len(normalized) > max_lines:
        merged: List[str] = []
        idx = 0
        while idx < len(normalized):
            first = normalized[idx]
            if idx + 1 < len(normalized):
                merged.append(join(first, normalized[idx + 1]))
                idx += 2
            else:
                merged.append(first)
                idx += 1
        normalized = merged

    return normalized


def has_cjk(text: str) -> bool:
    return any('\u4e00' <= ch <= '\u9fff' for ch in text)


def clean_title(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r'\s+\d.*$', '', raw)
    return raw.strip()


def _strip_embedded_heading(text: str) -> Optional[str]:
    for marker in SECTION_MARKERS:
        if marker in text:
            after = text.split(marker, 1)[1].strip()
            match = re.search(r'\b\d+\s+(.+)$', after)
            if match:
                return match.group(1).strip()
            return None if not after or _is_plain_heading(after) else after
    return text


def _is_plain_heading(text: str) -> bool:
    if not text:
        return True
    if any(ch.isdigit() for ch in text):
        return False
    for ch in text:
        if ch in PUNCTUATION_CHARS:
            return False
    return True


def sanitize_index(index_path: pathlib.Path) -> None:
    lines = index_path.read_text().splitlines()
    sanitized: List[str] = []
    expect_number_for: Optional[str] = None
    total = len(lines)
    idx = 0

    def next_number_match(start: int) -> Optional[str]:
        j = start + 1
        while j < total:
            nxt = lines[j].strip()
            if not nxt:
                j += 1
                continue
            match = re.match(r'^(\d+)\b', nxt)
            return match.group(1) if match else None
        return None

    while idx < total:
        line = lines[idx]
        stripped = line.strip()
        if not stripped:
            sanitized.append(line)
            idx += 1
            continue

        header_match = HEADER_REGEX.match(stripped)
        if header_match:
            title = re.sub(r'\s+\d+(?:\.\d+)+.*$', '', stripped)
            sanitized.append(title)
            expect_number_for = 'cn' if has_cjk(title) else 'en'
            idx += 1
            continue

        if stripped in ('特.', '和.', '特', '和'):
            idx += 1
            continue

        if METER_REGEX.match(stripped):
            idx += 1
            continue

        if any(token in stripped for token in METADATA_TOKENS):
            stanza_fragment = re.search(r'(\d+\s+.+)$', stripped)
            if stanza_fragment:
                leading_ws = line[:len(line) - len(line.lstrip())]
                sanitized.append(f"{leading_ws}{stanza_fragment.group(1)}")
                expect_number_for = None
            idx += 1
            continue

        num_match = re.match(r'^(\d+)\s+(.+)$', stripped)
        if num_match:
            number, rest = num_match.groups()
            stripped_heading = _strip_embedded_heading(rest)
            if stripped_heading is None:
                idx += 1
                continue
            if stripped_heading != rest:
                leading_ws = line[:len(line) - len(line.lstrip())]
                line = f"{leading_ws}{number} {stripped_heading}"
                stripped = line.strip()
                rest = stripped_heading

            next_number = next_number_match(idx)
            if next_number == number and _is_plain_heading(rest):
                idx += 1
                continue

        if expect_number_for and stripped and not stripped[0].isdigit():
            leading_ws = line[:len(line) - len(line.lstrip())]
            sanitized.append(f"{leading_ws}1 {stripped}")
            expect_number_for = None
            idx += 1
            continue

        if stripped and stripped[0].isdigit():
            expect_number_for = None

        sanitized.append(line)
        idx += 1

    index_path.write_text('\n'.join(sanitized).rstrip() + '\n')


def parse_block(block_lines: List[str], lang: str) -> List[Dict]:
    sections: List[Dict] = []
    stanza_counter = 0

    for raw in block_lines:
        stripped = raw.strip()
        if not stripped or any(token in stripped for token in METADATA_TOKENS):
            continue

        lower = stripped.lower()
        if lang == 'en' and any(lower.startswith(tok) for tok in CHORUS_TOKENS_EN):
            rest = stripped
            for tok in CHORUS_TOKENS_EN:
                if lower.startswith(tok):
                    rest = stripped[len(tok):].lstrip(' :.-')
                    break
            sections.append({'type': 'chorus', 'label': 'C', 'lines': [rest] if rest else []})
            continue

        if lang == 'cn' and any(stripped.startswith(tok) for tok in CHORUS_TOKENS_CN):
            rest = stripped
            for tok in CHORUS_TOKENS_CN:
                if stripped.startswith(tok):
                    rest = stripped[len(tok):].lstrip(' ：:')
                    break
            sections.append({'type': 'chorus', 'label': 'C', 'lines': [rest] if rest else []})
            continue

        match = re.match(r'^(\d+)\s+(.*)$', stripped)
        if match:
            stanza_counter = int(match.group(1))
            text = match.group(2).strip()
            sections.append({'type': 'verse', 'label': match.group(1), 'lines': [text] if text else []})
            continue

        if not sections:
            stanza_counter += 1
            sections.append({'type': 'verse', 'label': str(stanza_counter), 'lines': []})

        sections[-1]['lines'].append(stripped)

    for sec in sections:
        lang_code = 'en' if lang == 'en' else 'cn'
        sec['lines'] = collapse_lines(sec['lines'], lang_code)

    return sections


def generate_hymns(index_path: pathlib.Path, hymns_dir: pathlib.Path, *, prefix_number: bool = False) -> None:
    lines = index_path.read_text().splitlines()
    entries = []
    idx = 0
    n = len(lines)

    while idx < n:
        line = lines[idx].strip()
        header = HEADER_REGEX.match(line)
        if not header or not has_cjk(header.group(2)):
            idx += 1
            continue

        num = header.group(1)
        title_cn = header.group(2).strip()
        idx += 1

        cn_block = []
        while idx < n and not HEADER_REGEX.match(lines[idx].strip()):
            cn_block.append(lines[idx])
            idx += 1

        if idx >= n:
            break

        en_header_line = lines[idx].strip()
        idx += 1
        en_header = HEADER_REGEX.match(en_header_line)
        if not en_header:
            continue
        title_en = en_header.group(2).strip()

        en_block = []
        while idx < n:
            next_line = lines[idx].strip()
            next_header = HEADER_REGEX.match(next_line)
            if next_header and has_cjk(next_header.group(2)):
                break
            en_block.append(lines[idx])
            idx += 1

        entries.append({
            'num': num,
            'title_cn': title_cn,
            'title_en': title_en,
            'cn_lines': cn_block,
            'en_lines': en_block,
        })

    hymns_dir.mkdir(parents=True, exist_ok=True)

    for entry in entries:
        en_sections = parse_block(entry['en_lines'], 'en')
        cn_sections = parse_block(entry['cn_lines'], 'cn')

        title_en = clean_title(entry['title_en']) or f"Hymn {entry['num']}"
        title_cn = clean_title(entry['title_cn'])
        filename_title = title_en
        if prefix_number:
            filename_title = f"{entry['num']} {filename_title}"
        filename = f"{filename_title}.hymn"
        path = hymns_dir / filename

        def fmt(sec_list, label):
            out_lines = []
            for sec in sec_list:
                name = 'Chorus' if sec['type'] == 'chorus' else f"Verse {sec['label']}"
                out_lines.append(f"{name} {label}:")
                out_lines.extend(sec['lines'])
                out_lines.append('')
            return '\n'.join(out_lines).strip()

        content = (
            f"Title: {title_en} ({title_cn})\n"
            f"CCLI: {entry['num']}\n\n"
            f"{fmt(en_sections, 'English')}\n\n"
            f"{fmt(cn_sections, 'Chinese')}\n"
        )

        path.write_text(content)


def _section_lang(line: str) -> Optional[str]:
    stripped = line.strip()
    match = SECTION_HEADER_REGEX.match(stripped)
    if not match:
        return None
    return 'en' if match.group(2) == 'English' else 'cn'


def reformat_hymn_file(path: pathlib.Path) -> None:
    original_text = path.read_text()
    lines = original_text.splitlines()
    out_lines: List[str] = []
    idx = 0
    n = len(lines)

    while idx < n:
        line = lines[idx]
        lang = _section_lang(line)
        out_lines.append(line)
        idx += 1

        if not lang:
            continue

        block: List[str] = []
        while idx < n and lines[idx].strip():
            block.append(lines[idx])
            idx += 1

        collapsed = collapse_lines(block, lang)
        out_lines.extend(collapsed)

        blank_lines: List[str] = []
        while idx < n and not lines[idx].strip():
            blank_lines.append('')
            idx += 1

        out_lines.extend(blank_lines)

    new_text = '\n'.join(out_lines).rstrip() + '\n'
    if new_text != original_text:
        path.write_text(new_text)


def reformat_hymn_directory(hymn_dir: pathlib.Path) -> None:
    for hymn_file in hymn_dir.glob('*.hymn'):
        reformat_hymn_file(hymn_file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sanitize hymn index, generate hymns, or reformat existing hymn files.")
    parser.add_argument('index', type=pathlib.Path, nargs='?', help='Path to the index text file (e.g., public/index/101-200)')
    parser.add_argument('--generate', action='store_true', help='Generate hymn files from the sanitized index')
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('public/hymns'), help='Output directory for .hymn files')
    parser.add_argument('--prefix-number', action='store_true', help='Prefix the CCLI/hymn number to generated filenames')
    parser.add_argument('--reformat-hymns', action='store_true', help='Collate lines in existing .hymn files to fit four per stanza per language')
    parser.add_argument('--hymn-dir', type=pathlib.Path, default=pathlib.Path('public/hymns'), help='Directory containing .hymn files to reformat')
    args = parser.parse_args()

    if args.generate and args.index is None:
        parser.error('--generate requires an index file')

    if args.index:
        sanitize_index(args.index)
        if args.generate:
            generate_hymns(args.index, args.output, prefix_number=args.prefix_number)

    if args.reformat_hymns:
        reformat_hymn_directory(args.hymn_dir)

if __name__ == '__main__':
    main()
