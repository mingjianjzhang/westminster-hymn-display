import React, { useEffect, useMemo, useRef, useState } from "react";

function uid() { return Math.random().toString(36).slice(2); }
interface Verse { name: string; lines: string[]; type?: 'verse' | 'chorus' | 'other'; }
interface Song { id: string; title: string; ccliNo?: string; verseOrder: string[]; verses: Record<string, Verse>; preInterleaved?: boolean; }

function parseHymnFile(text: string, fixedId?: string): Song | null {
  try {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let title = "Untitled";
    let ccliNo: string | undefined;
    const verses: Record<string, Verse> = {};
    let inMetadata = true;
    let currentSectionKey = "";
    let currentLanguage: "english" | "chinese" | null = null;
    const verseOrder: string[] = [];
    const sectionCounts: Record<string, number> = {};
    const baseQueues: Record<string, string[]> = {};
    const baseKeyBySection: Record<string, string> = {};
    const sections: Record<string, { label: string; english: string[]; chinese: string[]; type: Verse['type']; hasChinese: boolean }> = {};

    const normalizeBase = (label: string) => label.trim().toLowerCase().replace(/\s+/g, " ");
    const detectType = (label: string): Verse['type'] => {
      const normalized = label.toLowerCase();
      if (normalized.startsWith("verse")) return "verse";
      if (normalized.startsWith("chorus")) return "chorus";
      if (normalized.startsWith("bridge") || normalized.startsWith("intro") || normalized.startsWith("outro") || normalized.startsWith("ending")) return "other";
      return "other";
    };
    const matchSectionHeading = (line: string) => {
      const match = line.match(/^(.+?) (English|Chinese):$/i);
      if (!match) return null;
      const base = match[1].trim();
      const lang = match[2].toLowerCase() as "english" | "chinese";
      const normalized = base.toLowerCase();
      if (!(normalized.startsWith("verse") || normalized.startsWith("chorus") || normalized.startsWith("bridge") || normalized.startsWith("intro") || normalized.startsWith("outro") || normalized.startsWith("ending"))) {
        return null;
      }
      return { base, lang, normalized };
    };
    const ensureSectionRecord = (key: string, label: string, type: Verse['type']) => {
      if (!sections[key]) {
        sections[key] = { label, english: [], chinese: [], type, hasChinese: false };
        verseOrder.push(key);
      } else if (!sections[key].label) {
        sections[key].label = label;
      }
    };
    const createSectionKey = (baseKey: string) => {
      const count = (sectionCounts[baseKey] || 0) + 1;
      sectionCounts[baseKey] = count;
      return count === 1 ? baseKey : `${baseKey}#${count}`;
    };
    const releaseFromBaseQueue = (key: string) => {
      const baseKey = baseKeyBySection[key];
      const queue = baseKey ? baseQueues[baseKey] : undefined;
      if (!queue || !queue.length) return;
      const idx = queue.indexOf(key);
      if (idx >= 0) queue.splice(idx, 1);
    };
    const findSectionForChinese = (baseKey: string, type: Verse['type'], fallbackLabel: string) => {
      const queue = baseQueues[baseKey];
      if (queue && queue.length) {
        while (queue.length) {
          const candidate = queue.shift()!;
          if (!sections[candidate]?.hasChinese) return candidate;
        }
      }
      if (type) {
        const candidate = verseOrder.find(key => sections[key]?.type === type && !sections[key].hasChinese);
        if (candidate) return candidate;
      }
      const fallback = verseOrder.find(key => !sections[key].hasChinese);
      if (fallback) return fallback;

      const derivedBase = baseKey || `section-${verseOrder.length + 1}`;
      const newKey = createSectionKey(derivedBase);
      ensureSectionRecord(newKey, fallbackLabel, type);
      baseKeyBySection[newKey] = derivedBase;
      return newKey;
    };

    const handleSectionHeading = (line: string) => {
      const match = matchSectionHeading(line);
      if (!match) return false;
      const { base, lang } = match;
      const baseKey = normalizeBase(base);
      const sectionType = detectType(base);

      if (lang === "english") {
        const key = createSectionKey(baseKey);
        ensureSectionRecord(key, base, sectionType);
        baseKeyBySection[key] = baseKey;
        baseQueues[baseKey] = baseQueues[baseKey] || [];
        baseQueues[baseKey].push(key);
        currentSectionKey = key;
        currentLanguage = "english";
      } else {
        const key = findSectionForChinese(baseKey, sectionType, base);
        ensureSectionRecord(key, sections[key]?.label || base, sectionType);
        releaseFromBaseQueue(key);
        sections[key].hasChinese = true;
        currentSectionKey = key;
        currentLanguage = "chinese";
      }
      return true;
    };

    for (const line of lines) {
      if (inMetadata) {
        if (line.startsWith("Title:")) {
          title = line.substring(6).trim();
          continue;
        }
        if (line.startsWith("CCLI:")) {
          ccliNo = line.substring(5).trim();
          continue;
        }
        if (handleSectionHeading(line)) {
          inMetadata = false;
        }
      } else {
        if (handleSectionHeading(line)) continue;
        if (line && currentSectionKey) {
          if (currentLanguage === "english") {
            sections[currentSectionKey]?.english.push(line);
          } else if (currentLanguage === "chinese") {
            sections[currentSectionKey]?.chinese.push(line);
          }
        }
      }
    }

    for (const key of verseOrder) {
      const section = sections[key];
      if (!section) continue;
      const englishLines = section.english;
      const chineseLines = section.chinese;
      const interleavedLines: string[] = [];
      const maxLines = Math.max(englishLines.length, chineseLines.length);
      for (let i = 0; i < maxLines; i++) {
        if (i < englishLines.length) interleavedLines.push(englishLines[i]);
        if (i < chineseLines.length) interleavedLines.push(chineseLines[i]);
      }
      verses[key] = { name: section.label, lines: interleavedLines, type: section.type };
    }

    return {
      id: fixedId || uid(),
      title,
      ccliNo,
      verseOrder,
      verses,
      preInterleaved: true
    };
  } catch {
    return null;
  }
}

const hymnModules = import.meta.glob("/public/hymns/*.hymn", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const preloadedHymns: Song[] = Object.entries(hymnModules).flatMap(([path, contents]) => {
  const song = parseHymnFile(contents);
  if (!song) return [];
  const filename = path.split("/").pop() || `hymn-${uid()}`;
  song.id = filename.replace(/\.[^/.]+$/, "");
  return song;
}).sort((a, b) => a.title.localeCompare(b.title));

function interleaveSlides(en: string[], zh: string[], sliceSize = 4) {
  const slides: string[][] = [];
  for (let i = 0; i < Math.max(en.length, zh.length); i += sliceSize) {
    const chunkEn = en.slice(i, i + sliceSize);
    const chunkZh = zh.slice(i, i + sliceSize);
    const interleaved: string[] = [];
    const n = Math.max(chunkEn.length, chunkZh.length);
    for (let j = 0; j < n; j++) { if (j < chunkEn.length) interleaved.push(chunkEn[j]); if (j < chunkZh.length) interleaved.push(chunkZh[j]); }
    slides.push(interleaved);
  }
  return slides;
}

const XML_SLICE_SIZE = 4;

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function filterSongsByCcli(list: Song[], query: string) {
  const digits = normalizeDigits(query.trim());
  if (!digits) return list;
  const queryNumber = Number(digits);
  if (Number.isNaN(queryNumber)) return list;
  return list.filter(song => {
    const songDigits = normalizeDigits(song.ccliNo || '');
    if (!songDigits) return false;
    const songNumber = Number(songDigits);
    if (Number.isNaN(songNumber)) return false;
    return songNumber === queryNumber;
  });
}

// BroadcastChannel for cross-window communication
const broadcastChannel = new BroadcastChannel('hymn-projector-sync');

// Control Screen Component
function ControlScreen({
  songs,
  currentSongId,
  setCurrentSongId,
  searchQuery,
  onSearchChange,
  totalSongCount,
  slides,
  slideIdx,
  setSlideIdx,
  onImport
}: {
  songs: Song[];
  currentSongId: string | null;
  setCurrentSongId: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  totalSongCount: number;
  slides: { label: string; lines: string[]; stzNumber?: string; layoutHint?: 'dense' }[];
  slideIdx: number;
  setSlideIdx: (idx: number) => void;
  onImport: (files: FileList | null) => void;
}) {
  return (
    <div className="w-full min-h-screen bg-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Hymn Projector - Control Panel</h1>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => window.open(window.location.href.replace('#/control', '#/display'), '_blank')}
            >
              Open Display Screen
            </button>
            <button
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              onClick={() => window.location.hash = '#/display'}
            >
              Switch to Display
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept=".hymn,.txt" multiple onChange={e=>onImport(e.target.files)} />
          <span className="text-sm text-gray-600">Import additional hymns</span>
        </div>

        <div className="p-3 rounded bg-white shadow flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Search by song number</label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Enter hymn number (e.g., 29)"
            className="flex-1 min-w-[220px] border rounded px-3 py-2 text-sm"
          />
          {searchQuery && (
            <button
              className="px-3 py-1 text-sm text-blue-600 hover:underline"
              onClick={() => onSearchChange("")}
            >
              Clear
            </button>
          )}
          <div className="text-xs text-slate-500 ml-auto">{songs.length} of {totalSongCount} hymns</div>
        </div>

        <div className="p-3 rounded bg-white shadow max-h-[40vh] overflow-auto">
          <div className="text-sm text-slate-500 mb-2">Songs</div>
          {songs.length === 0 ? (
            <div className="text-sm text-slate-500">
              {searchQuery.trim() ? `No hymns match “${searchQuery.trim()}”.` : 'No hymns available.'}
            </div>
          ) : (
            <ul className="space-y-1">
              {songs.map(s => (
                <li
                  key={s.id}
                  className={`p-2 rounded cursor-pointer ${currentSongId===s.id? 'bg-slate-800 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
                  onClick={()=>{setCurrentSongId(s.id);}}
                >
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs opacity-80">{s.ccliNo? `CCLI ${s.ccliNo}`: '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 rounded bg-white shadow">
          <div className="text-sm text-slate-500 mb-2">Slides ({slides.length}) - Current: {slideIdx + 1}</div>
          <div className="grid grid-cols-6 gap-2 max-h-[40vh] overflow-auto">
            {slides.map((sl, i)=>(
              <button key={i} onClick={()=>setSlideIdx(i)} className={`p-2 rounded border text-left ${i===slideIdx? 'border-black bg-slate-100' : 'border-slate-300 hover:bg-slate-50'}`}>
                <div className="text-xs font-mono mb-1">{sl.label}</div>
                <div className="text-[10px] line-clamp-3 opacity-80">{sl.lines.join(" • ")}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Display Screen Component
function DisplayScreen({ slides, slideIdx, currentSong, totalStanzas }: {
  slides: { label: string; lines: string[]; stzNumber?: string; stanzaIndex?: number; isChorus?: boolean; layoutHint?: 'dense' }[];
  slideIdx: number;
  currentSong: Song | null;
  totalStanzas: number;
}) {
  const projectorRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Ensure slideIdx is within bounds
  const safeSlideIdx = Math.min(slideIdx, slides.length - 1);
  const cur = slides[safeSlideIdx] || { label: "", lines: [] };
  const currentStanzaIndex = cur?.stanzaIndex || undefined;
  const isChorusSlide = cur?.isChorus;

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isActive = document.fullscreenElement === projectorRef.current;
      setIsFullscreen(isActive);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const projectorClasses = [
    "w-full aspect-video rounded-xl bg-blue-900 shadow-inner relative overflow-hidden cursor-pointer projector-canvas",
    isFullscreen ? "projector-canvas--live" : "projector-canvas--preview"
  ].join(" ");
  const bodyPadding = isFullscreen ? "p-[5%]" : "p-4 md:p-6";

  return (
    <div className="w-full min-h-screen bg-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Hymn Projector - Display Screen</h1>
          <button
            className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
            onClick={() => window.location.hash = '#/control'}
          >
            Switch to Controls
          </button>
        </div>

        <div
          ref={projectorRef}
          className={projectorClasses}
          style={{ backgroundColor: '#000066' }}
          onClick={() => projectorRef.current?.requestFullscreen?.()}
        >
          <div className="absolute inset-0 flex flex-col">
            <div className="h-1/6" />
            <div className={`flex-1 flex items-center justify-center ${bodyPadding}`}>
              <div className="w-full h-full flex items-center justify-center">
                <div
                  className={`projector-text text-center font-semibold leading-relaxed ${
                    cur.layoutHint === 'dense' ? 'projector-text--dense' : ''
                  }`}
                  style={{ color: '#ffff98' }}
                >
                  {cur.lines && cur.lines.length > 0 ? (
                    cur.lines.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))
                  ) : (
                    <div style={{ color: '#ffff98' }}>Loading...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="projector-title absolute top-4 inset-x-4 flex flex-col text-center text-sky-100 drop-shadow">
            <div className="projector-title__main font-semibold tracking-wide uppercase">
              {currentSong ? `${currentSong.ccliNo ? `${currentSong.ccliNo} • ` : ''}${currentSong.title.split('/')[0].trim()}` : ''}
            </div>
            {currentSong && (
              <div className="projector-title__subtitle opacity-90">{currentSong.title.includes('/') ? currentSong.title.split('/')[1]?.trim() : ''}</div>
            )}
            <div className="projector-title__divider mx-auto" />
          </div>
          {(isChorusSlide || totalStanzas > 0) && (
            <div className="projector-stanza-indicator">
              {isChorusSlide ? 'Chorus' : (currentStanzaIndex ? `${currentStanzaIndex}/${totalStanzas}` : `–/${totalStanzas}`)}
            </div>
          )}
          {!isFullscreen && (
            <div className="projector-preview-hint">
              Click to launch fullscreen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [currentView, setCurrentView] = useState<'control' | 'display'>('control');
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (preloadedHymns.length > 0) {
      setSongs(preloadedHymns);
      setCurrentSongId(preloadedHymns[0].id);
      console.log(`Loaded ${preloadedHymns.length} hymns`);
    } else {
      console.log('No hymn files found');
    }

  }, []);

  // Handle URL hash changes for routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/display') {
        setCurrentView('display');
      } else {
        setCurrentView('control');
      }
    };

    handleHashChange(); // Initial check
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // BroadcastChannel message handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      switch (type) {
        case 'SONG_CHANGE':
          setCurrentSongId(data.songId);
          setSlideIdx(0);
          break;
        case 'SLIDE_CHANGE':
          setSlideIdx(data.slideIdx);
          break;
        case 'SONGS_UPDATE':
          setSongs(data.songs);
          break;
      }
    };

    broadcastChannel.addEventListener('message', handleMessage);
    return () => broadcastChannel.removeEventListener('message', handleMessage);
  }, []);

  const currentSong = useMemo(() => songs.find(s => s.id === currentSongId) || null, [songs, currentSongId]);
  const filteredSongs = useMemo(() => filterSongsByCcli(songs, searchQuery), [songs, searchQuery]);

  const slides = useMemo(() => {
    if (!currentSong) return [] as { label: string; lines: string[], stzNumber?: string; stanzaIndex?: number; isChorus?: boolean; layoutHint?: 'dense' }[];
    const out: { label: string, lines: string[], stzNumber?: string, stanzaIndex?: number, isChorus?: boolean, layoutHint?: 'dense' }[] = [];
    const order = currentSong.verseOrder.length ? currentSong.verseOrder : Object.keys(currentSong.verses);
    let stanzaIdx = 0;
    for (const key of order) {
      const v = currentSong.verses[key]; if (!v) continue;

      const baseLabel = v.name || key;
      const isChorus = v.type === 'chorus' || baseLabel.toLowerCase().startsWith("chorus");
      const m = !isChorus ? baseLabel.match(/(\d+)/) : null;
      const stzNum = m ? m[1] : (isChorus ? "C" : undefined);
      if (!isChorus) stanzaIdx += 1;
      
      if (currentSong.preInterleaved) {
        // For pre-interleaved hymns (text format), chunk verses to max 8 lines per slide
        // Edge case: if we detect five English + five Chinese lines (10 total), allow all on one slide
        const englishLineEstimate = Math.ceil(v.lines.length / 2);
        const chineseLineEstimate = Math.floor(v.lines.length / 2);
        const hasFiveLineStanza = englishLineEstimate === 5 && chineseLineEstimate === 5;
        const chunkSize = hasFiveLineStanza ? 10 : 8;
        const chunkCount = Math.ceil(v.lines.length / chunkSize) || 1;
        for (let i = 0; i < v.lines.length; i += chunkSize) {
          const chunk = v.lines.slice(i, i + chunkSize);
          const chunkIndex = Math.floor(i / chunkSize);
          const labelBase = baseLabel || key;
          const label = chunkCount > 1 ? `${labelBase}${String.fromCharCode(97 + chunkIndex)}` : labelBase;
          out.push({
            label,
            lines: chunk,
            stzNumber: stzNum,
            stanzaIndex: isChorus ? undefined : stanzaIdx,
            isChorus,
            layoutHint: hasFiveLineStanza ? 'dense' : undefined
          });
        }
        if (v.lines.length === 0) {
          out.push({ label: key, lines: [], stzNumber: stzNum, stanzaIndex: isChorus ? undefined : stanzaIdx, isChorus });
        }
      } else {
        // For XML hymns, apply chunking based on slice size fallback
        const lines = v.lines;
        const chunkCount = Math.ceil(lines.length / XML_SLICE_SIZE);
        
        for (let i = 0; i < lines.length; i += XML_SLICE_SIZE) {
          const chunk = lines.slice(i, i + XML_SLICE_SIZE);
          const chunkIndex = Math.floor(i / XML_SLICE_SIZE);
          const label = chunkCount > 1 ? `${key}${String.fromCharCode(97 + chunkIndex)}` : key;
          
          out.push({ 
            label, 
            lines: chunk, 
            stzNumber: stzNum,
            stanzaIndex: isChorus ? undefined : stanzaIdx,
            isChorus,
            layoutHint: chunk.length >= 10 ? 'dense' : undefined
          });
        }
      }
    }
    return out;
  }, [currentSong]);

  const totalStanzas = useMemo(() => {
    const indices = new Set<number>();
    for (const slide of slides) {
      if (slide.stanzaIndex) indices.add(slide.stanzaIndex);
    }
    return indices.size;
  }, [slides]);

  // Ensure slideIdx is always within bounds
  const boundedSlideIdx = useMemo(() => Math.min(slideIdx, slides.length - 1), [slideIdx, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") setSlideIdx(i => Math.min(slides.length-1, i+1));
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") setSlideIdx(i => Math.max(0, i-1));
      else if (e.key.toLowerCase() === "f") {
        const projectorEl = document.querySelector('.projector-canvas') as HTMLElement | null;
        projectorEl?.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  async function onImport(files: FileList | null) {
    if (!files) return;
    const imported: Song[] = [];
    for (const f of Array.from(files)) {
      const txt = await f.text();
      const s = parseHymnFile(txt);
      if (s) imported.push(s);
    }
    const newSongs = [...songs, ...imported];
    setSongs(newSongs);
    if (!currentSongId && imported[0]) setCurrentSongId(imported[0].id);

    // Broadcast songs update
    broadcastChannel.postMessage({
      type: 'SONGS_UPDATE',
      data: { songs: newSongs }
    });
  }

  // Enhanced setters that broadcast changes
  const enhancedSetCurrentSongId = (songId: string | null) => {
    setCurrentSongId(songId);
    setSlideIdx(0); // Reset slide to first when changing songs
    broadcastChannel.postMessage({ type: 'SONG_CHANGE', data: { songId } });
  };

  const enhancedSetSlideIdx = (newSlideIdx: number) => {
    setSlideIdx(newSlideIdx);
    broadcastChannel.postMessage({ type: 'SLIDE_CHANGE', data: { slideIdx: newSlideIdx } });
  };

  if (currentView === 'display') {
    return <DisplayScreen slides={slides} slideIdx={boundedSlideIdx} currentSong={currentSong} totalStanzas={totalStanzas} />;
  }

  return (
    <ControlScreen
      songs={filteredSongs}
      currentSongId={currentSongId}
      setCurrentSongId={enhancedSetCurrentSongId}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      totalSongCount={songs.length}
      slides={slides}
      slideIdx={boundedSlideIdx}
      setSlideIdx={enhancedSetSlideIdx}
      onImport={onImport}
    />
  );
}
