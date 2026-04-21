import React, { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { toPng } from 'html-to-image';
import {
  FaMapMarkerAlt, FaStar, FaHeart, FaHome, FaCamera,
  FaTree, FaUtensils, FaBed, FaCar, FaPlane,
  FaShoppingBag, FaCoffee, FaMusic, FaFlag, FaLightbulb,
  FaExclamationTriangle, FaCheck, FaQuestion, FaInfo, FaTrash,
} from 'react-icons/fa';
import {
  FaEdit, FaDownload, FaUpload, FaTimes, FaPlus, FaPen,
} from 'react-icons/fa';

// IconPicker caricato in lazy: contiene migliaia di icone,
// non le vogliamo nel bundle iniziale.
const IconPicker = lazy(() => import('./IconPicker.jsx'));

// ============ DEFAULT ICON PALETTE ============
// Le icone di partenza nella palette. L'utente può aggiungerne altre dalla
// libreria completa tramite il picker.
const DEFAULT_ICONS = [
  'FaMapMarkerAlt', 'FaStar', 'FaHeart', 'FaHome', 'FaCamera',
  'FaTree', 'FaUtensils', 'FaBed', 'FaCar', 'FaPlane',
  'FaShoppingBag', 'FaCoffee', 'FaMusic', 'FaFlag', 'FaLightbulb',
  'FaExclamationTriangle', 'FaCheck', 'FaQuestion', 'FaInfo',
];

// Mappa statica per accesso veloce alle icone di default (incluse nel bundle iniziale).
// Le icone aggiunte dal picker vengono risolte tramite FULL_ICON_MAP.
const DEFAULT_ICON_COMPONENTS = {
  FaMapMarkerAlt, FaStar, FaHeart, FaHome, FaCamera,
  FaTree, FaUtensils, FaBed, FaCar, FaPlane,
  FaShoppingBag, FaCoffee, FaMusic, FaFlag, FaLightbulb,
  FaExclamationTriangle, FaCheck, FaQuestion, FaInfo,
};

// Helper: risolve un nome di icona nel suo componente React.
// Le icone di default sono sempre risolvibili; quelle custom vengono
// aggiunte alla cache quando l'utente le seleziona dal picker.
const makeResolver = (customCache) => (name) =>
  DEFAULT_ICON_COMPONENTS[name] || customCache[name] || FaMapMarkerAlt;

const COLOR_PALETTE = [
  '#c8422b', // rosso (accent)
  '#1a1612', // nero
  '#e8a317', // giallo senape
  '#2d6a4f', // verde bosco
  '#1e4d6b', // blu notte
  '#8b4789', // viola
  '#d85a7f', // rosa scuro
  '#c97b37', // arancio bruciato
];

// Mappa delle dimensioni testo usata sia dal preview che dall'export stage.
// I valori sono espressi in px e controllano tutto ciò che riguarda
// la tipografia della legenda (label, descrizione, icone, spacing).
const TEXT_SIZE_MAP = {
  small:  { label: 12, desc: 10, icon: 14, gap: 6,  pad: 10 },
  medium: { label: 14, desc: 12, icon: 18, gap: 8,  pad: 14 },
  large:  { label: 17, desc: 14, icon: 22, gap: 10, pad: 18 },
};

// ============ APP ============
export default function App() {
  const [image, setImage] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [iconPalette, setIconPalette] = useState(DEFAULT_ICONS);
  const [selectedIcon, setSelectedIcon] = useState('FaMapMarkerAlt');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isDraggingIcon, setIsDraggingIcon] = useState(false);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [dragTargetOver, setDragTargetOver] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Picker delle icone: null = chiuso, oppure oggetto con la modalità:
  //   { mode: 'palette' } → aggiunge l'icona alla palette
  //   { mode: 'marker', markerId } → sostituisce l'icona di un marker
  const [pickerState, setPickerState] = useState(null);
  const [customIconCache, setCustomIconCache] = useState({});

  // Dimensione di default per i nuovi marker. Ogni marker ha poi un suo
  // campo `size` che può essere sovrascritto individualmente.
  const [defaultMarkerSize, setDefaultMarkerSize] = useState(32);

  // Modale di esportazione PNG (permette di configurare la legenda)
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOpts, setExportOpts] = useState({
    includeLegend: true,
    position: 'bottom-strip', // bottom-strip | right-strip | top-left | top-right | bottom-left | bottom-right
    textSize: 'medium',        // small | medium | large
    background: 'solid',       // solid | transparent
  });

  // Preview live della legenda sull'immagine (stesse opzioni dell'export)
  const [showLegendPreview, setShowLegendPreview] = useState(false);

  const fileInputRef = useRef(null);
  const dataInputRef = useRef(null);
  const imageContainerRef = useRef(null);
  const exportStageRef = useRef(null);
  const draggedMarkerRef = useRef(null);

  // Resolver memoizzato in base alla cache corrente
  const resolveIcon = makeResolver(customIconCache);

  // ============ IMAGE UPLOAD ============
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target.result);
      setMarkers([]);
      setSelectedMarkerId(null);
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    if (markers.length === 0 || confirm('Resettare? Tutti i marker verranno persi.')) {
      setImage(null);
      setMarkers([]);
      setSelectedMarkerId(null);
      setEditingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============ MARKER CREATION ============
  const addMarkerAt = (xPct, yPct, iconName = selectedIcon, color = selectedColor) => {
    const newMarker = {
      id: Date.now() + Math.random(),
      x: xPct,
      y: yPct,
      icon: iconName,
      color: color,
      size: defaultMarkerSize,
      label: `Marker ${markers.length + 1}`,
      description: '',
    };
    setMarkers((m) => [...m, newMarker]);
    setSelectedMarkerId(newMarker.id);
  };

  const handleImageClick = (e) => {
    if (isDraggingMarker) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    addMarkerAt(xPct, yPct);
  };

  // ============ DRAG & DROP FROM PALETTE ============
  const handleIconDragStart = (e, iconName) => {
    setIsDraggingIcon(true);
    e.dataTransfer.setData('application/x-icon', iconName);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleIconDragEnd = () => {
    setIsDraggingIcon(false);
    setDragTargetOver(false);
  };

  // ============ ADD ICON FROM LIBRARY ============
  // Il picker passa sia il nome che il componente React risolto,
  // così lo salviamo nella cache senza dover re-importare la libreria.
  // Il comportamento dipende da pickerState.mode:
  //   - 'palette': aggiunge l'icona alla palette e la seleziona come attiva
  //   - 'marker':  sostituisce l'icona del marker indicato
  const handleAddIconFromLibrary = (iconName, IconComponent) => {
    // In ogni caso cachaimo il componente per poterlo risolvere
    setCustomIconCache((prev) => ({ ...prev, [iconName]: IconComponent }));

    if (pickerState?.mode === 'marker') {
      updateMarker(pickerState.markerId, { icon: iconName });
    } else {
      // Default: 'palette'
      setIconPalette((prev) => (prev.includes(iconName) ? prev : [...prev, iconName]));
      setSelectedIcon(iconName);
    }
    setPickerState(null);
  };

  const handleRemoveIconFromPalette = (iconName) => {
    // Non rimuovere se è l'unica icona o se è tra le default
    if (DEFAULT_ICONS.includes(iconName)) return;
    setIconPalette((prev) => prev.filter((n) => n !== iconName));
    if (selectedIcon === iconName) {
      setSelectedIcon(DEFAULT_ICONS[0]);
    }
  };

  const handleCanvasDragOver = (e) => {
    if (isDraggingIcon) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragTargetOver(true);
    }
  };

  const handleCanvasDragLeave = () => {
    setDragTargetOver(false);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setDragTargetOver(false);
    const iconName = e.dataTransfer.getData('application/x-icon');
    if (!iconName || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
    addMarkerAt(xPct, yPct, iconName, selectedColor);
  };

  // ============ MARKER DRAG (reposition) ============
  const handleMarkerMouseDown = (e, markerId) => {
    e.stopPropagation();
    setSelectedMarkerId(markerId);
    draggedMarkerRef.current = markerId;
    setIsDraggingMarker(true);

    const onMouseMove = (ev) => {
      if (!imageContainerRef.current) return;
      const rect = imageContainerRef.current.getBoundingClientRect();
      let xPct = ((ev.clientX - rect.left) / rect.width) * 100;
      let yPct = ((ev.clientY - rect.top) / rect.height) * 100;
      xPct = Math.max(0, Math.min(100, xPct));
      yPct = Math.max(0, Math.min(100, yPct));
      setMarkers((prev) =>
        prev.map((m) => (m.id === draggedMarkerRef.current ? { ...m, x: xPct, y: yPct } : m))
      );
    };

    const onMouseUp = () => {
      draggedMarkerRef.current = null;
      setTimeout(() => setIsDraggingMarker(false), 50);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ============ MARKER EDIT / DELETE ============
  const updateMarker = (id, updates) => {
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const deleteMarker = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
    if (editingId === id) setEditingId(null);
  };

  // ============ EXPORT PNG ============
  // L'export avviene catturando uno "stage" off-screen che monta immagine +
  // legenda secondo le opzioni scelte. Così la vista editor resta invariata
  // e abbiamo pieno controllo sul layout del PNG finale.
  const handleOpenExport = () => {
    if (!image) return;
    setExportOpen(true);
  };

  const handleConfirmExport = useCallback(async () => {
    // Attendiamo un frame perché React renderizzi lo stage aggiornato
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!exportStageRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportStageRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: exportOpts.background === 'transparent' ? undefined : '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `image-with-markers-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setExportOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Esportazione fallita: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, exportOpts.background]);

  const handleExportLegend = () => {
    if (markers.length === 0) return;
    const lines = [
      'LEGENDA MARKER',
      '='.repeat(40),
      '',
      ...markers.map((m, i) =>
        `${i + 1}. ${m.label}\n   Icona: ${m.icon} | Colore: ${m.color}\n   ${m.description || '(nessuna descrizione)'}\n`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `legenda-${Date.now()}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ============ MARKER DATA EXPORT / IMPORT (JSON) ============
  // Esportiamo solo i marker (posizione %, icona, colore, dimensione, testi)
  // così sono riutilizzabili su immagini diverse. L'immagine NON è inclusa.
  const handleExportMarkers = () => {
    if (markers.length === 0) return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      markers: markers.map((m) => ({
        x: m.x,
        y: m.y,
        icon: m.icon,
        color: m.color,
        size: m.size,
        label: m.label,
        description: m.description,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `markers-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMarkers = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || !Array.isArray(data.markers)) {
          throw new Error('Formato non valido: manca l\'array "markers"');
        }
        // Ricostruiamo i marker con nuovi id per evitare collisioni
        const imported = data.markers.map((m, i) => ({
          id: Date.now() + Math.random() + i,
          x: Number(m.x) || 0,
          y: Number(m.y) || 0,
          icon: m.icon || 'FaMapMarkerAlt',
          color: m.color || COLOR_PALETTE[0],
          size: Number(m.size) || defaultMarkerSize,
          label: m.label || `Marker ${i + 1}`,
          description: m.description || '',
        }));

        // Sostituisci o aggiungi in coda?
        const mode = markers.length === 0
          ? 'replace'
          : confirm(
              `Ho trovato ${imported.length} marker nel file.\n\n` +
              `OK = sostituisci i ${markers.length} marker attuali\n` +
              `Annulla = aggiungi in coda`
            ) ? 'replace' : 'append';

        if (mode === 'replace') {
          setMarkers(imported);
        } else {
          setMarkers((prev) => [...prev, ...imported]);
        }
        setSelectedMarkerId(null);
        setEditingId(null);
      } catch (err) {
        alert('Impossibile importare i marker: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset input così puoi re-importare lo stesso file
    e.target.value = '';
  };

  // ============ RENDER ============
  const SelectedIconComponent = resolveIcon(selectedIcon);

  return (
    <div className="app">

      {/* ========== LEFT PANEL : TOOLS ========== */}
      <aside className="panel">
        <div className="brand">
          <div className="brand-num">N° 01 — STUDIO</div>
          <div className="brand-title">
            Image<br/><em>Marker</em>
          </div>
          <div className="brand-desc">
            Annota immagini con icone, colori e leggende. Poi scaricale.
          </div>
        </div>

        <div className="section">
          <div className="section-label">File sorgente</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-primary btn-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <FaUpload /> {image ? 'Cambia immagine' : 'Carica immagine'}
          </button>
          {image && (
            <button
              className="btn btn-sm btn-full"
              onClick={handleReset}
              style={{ marginTop: 8 }}
            >
              <FaTimes /> Reset
            </button>
          )}
        </div>

        <div className="section">
          <div className="section-label">Icona attiva</div>
          <div className="icon-grid">
            {iconPalette.map((name) => {
              const Icon = resolveIcon(name);
              const isCustom = !DEFAULT_ICONS.includes(name);
              return (
                <div
                  key={name}
                  className={`icon-cell ${selectedIcon === name ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(name)}
                  onContextMenu={(e) => {
                    if (isCustom) {
                      e.preventDefault();
                      handleRemoveIconFromPalette(name);
                    }
                  }}
                  draggable
                  onDragStart={(e) => handleIconDragStart(e, name)}
                  onDragEnd={handleIconDragEnd}
                  title={isCustom
                    ? `${name} — click sinistro: seleziona · click destro: rimuovi`
                    : `${name} — trascina sull'immagine o clicca per selezionare`
                  }
                >
                  <Icon />
                </div>
              );
            })}
            <div
              className="icon-cell add-cell"
              onClick={() => setPickerState({ mode: 'palette' })}
              title="Aggiungi un'icona dalla libreria completa"
            >
              <FaPlus />
            </div>
          </div>
          <p className="mono" style={{ marginTop: 8, color: 'var(--ink-soft)', fontSize: 10 }}>
            + per sfogliare migliaia di icone · click destro su quelle custom per rimuoverle
          </p>
        </div>

        <div className="section">
          <div className="section-label">Colore</div>
          <div className="color-row">
            {COLOR_PALETTE.map((c) => (
              <div
                key={c}
                className={`color-swatch ${selectedColor === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setSelectedColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-label">Dimensione</div>
          <div className="size-row">
            <input
              type="range"
              min="16"
              max="80"
              step="2"
              value={defaultMarkerSize}
              onChange={(e) => setDefaultMarkerSize(Number(e.target.value))}
              className="range"
            />
            <span className="size-value mono">{defaultMarkerSize}px</span>
          </div>
          <p className="mono" style={{ marginTop: 6, color: 'var(--ink-soft)', fontSize: 10 }}>
            Default per i nuovi marker · override per-marker dalla legenda
          </p>
        </div>

        <div className="section">
          <div className="section-label">Marker data</div>
          <input
            ref={dataInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportMarkers}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              className="btn btn-sm"
              onClick={() => dataInputRef.current?.click()}
              title="Importa marker da file .json"
            >
              <FaUpload /> Importa
            </button>
            <button
              className="btn btn-sm"
              onClick={handleExportMarkers}
              disabled={markers.length === 0}
              title="Esporta marker in file .json"
            >
              <FaDownload /> Esporta
            </button>
          </div>
        </div>

        <div className="section" style={{ flex: 1 }}>
          <div className="section-label">Anteprima</div>
          <div style={{
            padding: 16,
            border: '1.5px solid var(--rule)',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 80,
          }}>
            <SelectedIconComponent
              size={defaultMarkerSize}
              color={selectedColor}
              style={{ filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,0.3))' }}
            />
          </div>
          <p className="mono" style={{ marginTop: 8, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            → Click sull'immagine<br/>
            → Oppure trascina l'icona
          </p>
        </div>

        <div className="footer-stripe">
          <span>v1.0</span>
          <span>EST. 2026</span>
        </div>
      </aside>

      {/* ========== CENTER : CANVAS ========== */}
      <main className="canvas-area">
        <div className="canvas-toolbar">
          <div className="toolbar-info">
            <span>📷 <strong>{image ? 'CARICATA' : 'NESSUNA IMMAGINE'}</strong></span>
            <span>•</span>
            <span>MARKER: <strong>{markers.length}</strong></span>
            {selectedMarkerId && <>
              <span>•</span>
              <span>SELEZIONATO: <strong>#{markers.findIndex(m => m.id === selectedMarkerId) + 1}</strong></span>
            </>}
          </div>
          <div className="toolbar-actions">
            <button
              className={`btn btn-sm ${showLegendPreview ? 'btn-primary' : ''}`}
              onClick={() => setShowLegendPreview((v) => !v)}
              disabled={!image || markers.length === 0}
              title="Mostra anteprima legenda direttamente sull'immagine"
            >
              {showLegendPreview ? <FaCheck /> : <FaInfo />} Legenda in mappa
            </button>
            <button
              className="btn btn-accent"
              onClick={handleOpenExport}
              disabled={!image || isExporting}
            >
              <FaDownload /> Scarica PNG
            </button>
          </div>
        </div>

        {/* Pannello controlli legenda (visibile solo quando preview attivo) */}
        {showLegendPreview && image && markers.length > 0 && (
          <div className="legend-controls-bar">
            <div className="lcb-group">
              <span className="mono lcb-label">Posizione</span>
              <div className="lcb-buttons">
                {[
                  { id: 'top-left',     l: '↖' },
                  { id: 'top-right',    l: '↗' },
                  { id: 'bottom-left',  l: '↙' },
                  { id: 'bottom-right', l: '↘' },
                  { id: 'bottom-strip', l: '↓' },
                  { id: 'right-strip',  l: '→' },
                ].map((p) => (
                  <button
                    key={p.id}
                    className={`btn btn-sm lcb-btn ${exportOpts.position === p.id ? 'btn-primary' : ''}`}
                    onClick={() => setExportOpts((o) => ({ ...o, position: p.id }))}
                    title={p.id}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="lcb-group">
              <span className="mono lcb-label">Testo</span>
              <div className="lcb-buttons">
                {['small', 'medium', 'large'].map((s) => (
                  <button
                    key={s}
                    className={`btn btn-sm lcb-btn ${exportOpts.textSize === s ? 'btn-primary' : ''}`}
                    onClick={() => setExportOpts((o) => ({ ...o, textSize: s }))}
                  >
                    {s === 'small' ? 'S' : s === 'medium' ? 'M' : 'L'}
                  </button>
                ))}
              </div>
            </div>
            <div className="lcb-group">
              <span className="mono lcb-label">Sfondo</span>
              <div className="lcb-buttons">
                <button
                  className={`btn btn-sm lcb-btn ${exportOpts.background === 'solid' ? 'btn-primary' : ''}`}
                  onClick={() => setExportOpts((o) => ({ ...o, background: 'solid' }))}
                >
                  Solido
                </button>
                <button
                  className={`btn btn-sm lcb-btn ${exportOpts.background === 'transparent' ? 'btn-primary' : ''}`}
                  onClick={() => setExportOpts((o) => ({ ...o, background: 'transparent' }))}
                >
                  Trasp.
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="canvas-stage">
          {!image ? (
            <div className={`canvas-empty ${dragTargetOver ? 'drag-over' : ''}`}>
              <div className="empty-icon"><FaCamera /></div>
              <div className="empty-title">Carica un'immagine<br/>per iniziare</div>
              <div className="empty-desc">
                JPG, PNG, WebP. Nessun upload verso server —<br/>tutto rimane sul tuo dispositivo.
              </div>
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaUpload /> Seleziona file
              </button>
            </div>
          ) : (
            <div
              className={`editor-wrap editor-wrap-${showLegendPreview ? exportOpts.position : 'none'}`}
            >
              <div
                ref={imageContainerRef}
                className={`image-container ${dragTargetOver ? 'drag-over' : ''}`}
                onClick={handleImageClick}
                onDragOver={handleCanvasDragOver}
                onDragLeave={handleCanvasDragLeave}
                onDrop={handleCanvasDrop}
              >
                <img src={image} alt="uploaded" className="uploaded-image" />
                {markers.map((m, i) => {
                  const Icon = resolveIcon(m.icon);
                  return (
                    <div
                      key={m.id}
                      className={`marker ${selectedMarkerId === m.id ? 'selected' : ''}`}
                      style={{
                        left: `${m.x}%`,
                        top: `${m.y}%`,
                        color: m.color,
                        fontSize: m.size || defaultMarkerSize,
                      }}
                      onMouseDown={(e) => handleMarkerMouseDown(e, m.id)}
                      onClick={(e) => e.stopPropagation()}
                      title={m.label}
                    >
                      <Icon />
                      <span className="marker-badge">{i + 1}</span>
                    </div>
                  );
                })}

                {/* Legenda in overlay (angoli) — sopra l'immagine */}
                {showLegendPreview && markers.length > 0 &&
                 ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(exportOpts.position) && (
                  <div
                    className="legend-preview-overlay"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <LegendBlock
                      markers={markers}
                      resolveIcon={resolveIcon}
                      ts={TEXT_SIZE_MAP[exportOpts.textSize]}
                      overlayPosition={exportOpts.position}
                      background={exportOpts.background}
                    />
                  </div>
                )}
              </div>

              {/* Legenda in strip esterna */}
              {showLegendPreview && markers.length > 0 &&
               (exportOpts.position === 'bottom-strip' || exportOpts.position === 'right-strip') && (
                <div className="legend-preview-strip">
                  <LegendBlock
                    markers={markers}
                    resolveIcon={resolveIcon}
                    ts={TEXT_SIZE_MAP[exportOpts.textSize]}
                    stripMode={exportOpts.position}
                    background="solid"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========== RIGHT PANEL : LEGEND ========== */}
      <aside className="panel">
        <div className="panel-header">
          <div className="panel-title">Legenda</div>
          <div className="panel-subtitle mono">{markers.length} voci</div>
        </div>

        {markers.length === 0 ? (
          <div className="legend-empty">
            Nessun marker aggiunto.<br/>
            Clicca o trascina sull'immagine per iniziare.
          </div>
        ) : (
          <div className="legend-list">
            {markers.map((m, i) => {
              const Icon = resolveIcon(m.icon);
              const isEditing = editingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`legend-item ${selectedMarkerId === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMarkerId(m.id)}
                >
                  <div className="legend-item-head">
                    <div className="legend-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="legend-icon" style={{ color: m.color }}>
                      <Icon />
                    </div>
                    <div className="legend-content">
                      {!isEditing ? (
                        <>
                          <div className="legend-label">{m.label}</div>
                          {m.description && (
                            <div className="legend-desc">{m.description}</div>
                          )}
                        </>
                      ) : (
                        <div className="legend-edit-form" onClick={(e) => e.stopPropagation()}>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="field-label">Icona</label>
                            <div className="icon-change-row">
                              {iconPalette.map((name) => {
                                const PaletteIcon = resolveIcon(name);
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    className={`icon-change-cell ${m.icon === name ? 'selected' : ''}`}
                                    onClick={() => updateMarker(m.id, { icon: name })}
                                    title={name}
                                    style={{ color: m.icon === name ? m.color : undefined }}
                                  >
                                    <PaletteIcon />
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className="icon-change-cell icon-change-more"
                                onClick={() => setPickerState({ mode: 'marker', markerId: m.id })}
                                title="Scegli un'altra icona dalla libreria completa"
                              >
                                <FaPlus />
                              </button>
                            </div>
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="field-label">Etichetta</label>
                            <input
                              className="input"
                              value={m.label}
                              onChange={(e) => updateMarker(m.id, { label: e.target.value })}
                              autoFocus
                            />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="field-label">Descrizione</label>
                            <textarea
                              className="textarea"
                              value={m.description}
                              onChange={(e) => updateMarker(m.id, { description: e.target.value })}
                              placeholder="Aggiungi dettagli..."
                            />
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="field-label">Colore</label>
                            <div className="color-row">
                              {COLOR_PALETTE.map((c) => (
                                <div
                                  key={c}
                                  className={`color-swatch ${m.color === c ? 'selected' : ''}`}
                                  style={{ background: c, width: 22, height: 22 }}
                                  onClick={() => updateMarker(m.id, { color: c })}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="field-label">
                              Dimensione · {m.size || defaultMarkerSize}px
                            </label>
                            <input
                              type="range"
                              min="16"
                              max="80"
                              step="2"
                              value={m.size || defaultMarkerSize}
                              onChange={(e) => updateMarker(m.id, { size: Number(e.target.value) })}
                              className="range"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="legend-actions">
                    {isEditing ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      >
                        <FaCheck /> Fatto
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm"
                        onClick={(e) => { e.stopPropagation(); setEditingId(m.id); }}
                      >
                        <FaPen /> Modifica
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); deleteMarker(m.id); }}
                      style={{ color: 'var(--accent)' }}
                    >
                      <FaTrash /> Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {markers.length > 0 && (
          <div className="section" style={{ marginTop: 'auto', borderBottom: 'none', borderTop: '1.5px solid var(--rule)' }}>
            <button
              className="btn btn-full"
              onClick={handleExportLegend}
            >
              <FaDownload /> Scarica legenda .txt
            </button>
          </div>
        )}
      </aside>

      {/* ========== ICON PICKER MODAL (lazy-loaded) ========== */}
      {pickerState && (
        <Suspense fallback={
          <div className="picker-overlay">
            <div className="picker-modal" style={{ padding: 60, textAlign: 'center' }}>
              <div className="serif" style={{ fontSize: 28, fontStyle: 'italic' }}>
                Carico la libreria...
              </div>
              <div className="mono" style={{ marginTop: 12, color: 'var(--ink-soft)' }}>
                Migliaia di icone in arrivo
              </div>
            </div>
          </div>
        }>
          <IconPicker
            onSelect={handleAddIconFromLibrary}
            onClose={() => setPickerState(null)}
          />
        </Suspense>
      )}

      {/* ========== EXPORT MODAL ========== */}
      {exportOpen && (
        <ExportModal
          opts={exportOpts}
          setOpts={setExportOpts}
          markersCount={markers.length}
          onClose={() => setExportOpen(false)}
          onConfirm={handleConfirmExport}
          isExporting={isExporting}
        />
      )}

      {/* ========== EXPORT STAGE (off-screen render target) ========== */}
      {/* Questo stage viene montato solo quando la modale è aperta, così
          toPng cattura esattamente l'output che l'utente ha configurato.
          È posizionato fuori dal viewport per non disturbare l'editor. */}
      {exportOpen && image && (
        <div className="export-stage-wrap" aria-hidden="true">
          <ExportStage
            ref={exportStageRef}
            image={image}
            markers={markers}
            opts={exportOpts}
            resolveIcon={resolveIcon}
            defaultSize={defaultMarkerSize}
          />
        </div>
      )}

    </div>
  );
}

// ============================================================
// EXPORT MODAL
// ============================================================
function ExportModal({ opts, setOpts, markersCount, onClose, onConfirm, isExporting }) {
  const update = (patch) => setOpts((o) => ({ ...o, ...patch }));

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="panel-title">Esporta PNG</div>
            <div className="panel-subtitle mono">
              {markersCount} marker · configura la legenda
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} disabled={isExporting}>
            <FaTimes /> Chiudi
          </button>
        </div>

        <div className="export-body">
          <div className="export-field">
            <label className="field-label">Includere la legenda?</label>
            <div className="export-toggle">
              <button
                className={`btn btn-sm ${opts.includeLegend ? 'btn-primary' : ''}`}
                onClick={() => update({ includeLegend: true })}
              >
                <FaCheck /> Sì, includi
              </button>
              <button
                className={`btn btn-sm ${!opts.includeLegend ? 'btn-primary' : ''}`}
                onClick={() => update({ includeLegend: false })}
              >
                <FaTimes /> Solo immagine
              </button>
            </div>
          </div>

          {opts.includeLegend && markersCount > 0 && (
            <>
              <div className="export-field">
                <label className="field-label">Posizione</label>
                <div className="pos-grid">
                  {[
                    { id: 'top-left',      label: 'Sovrapposta ↖' },
                    { id: 'top-right',     label: 'Sovrapposta ↗' },
                    { id: 'bottom-left',   label: 'Sovrapposta ↙' },
                    { id: 'bottom-right',  label: 'Sovrapposta ↘' },
                    { id: 'bottom-strip',  label: 'Strip sotto ↓' },
                    { id: 'right-strip',   label: 'Strip a destra →' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      className={`btn btn-sm ${opts.position === p.id ? 'btn-primary' : ''}`}
                      onClick={() => update({ position: p.id })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="export-field">
                <label className="field-label">Dimensione testo</label>
                <div className="export-toggle">
                  {['small', 'medium', 'large'].map((s) => (
                    <button
                      key={s}
                      className={`btn btn-sm ${opts.textSize === s ? 'btn-primary' : ''}`}
                      onClick={() => update({ textSize: s })}
                    >
                      {s === 'small' ? 'S' : s === 'medium' ? 'M' : 'L'} — {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="export-field">
                <label className="field-label">Sfondo legenda</label>
                <div className="export-toggle">
                  <button
                    className={`btn btn-sm ${opts.background === 'solid' ? 'btn-primary' : ''}`}
                    onClick={() => update({ background: 'solid' })}
                  >
                    Solido
                  </button>
                  <button
                    className={`btn btn-sm ${opts.background === 'transparent' ? 'btn-primary' : ''}`}
                    onClick={() => update({ background: 'transparent' })}
                  >
                    Semi-trasparente
                  </button>
                </div>
                <p className="mono" style={{ marginTop: 6, color: 'var(--ink-soft)', fontSize: 10 }}>
                  Per le strip esterne lo sfondo è sempre solido
                </p>
              </div>
            </>
          )}

          <div className="export-actions">
            <button className="btn" onClick={onClose} disabled={isExporting}>
              Annulla
            </button>
            <button
              className="btn btn-accent"
              onClick={onConfirm}
              disabled={isExporting}
            >
              <FaDownload /> {isExporting ? 'Esporto...' : 'Scarica PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXPORT STAGE — renderer off-screen catturato da html-to-image
// ============================================================
const ExportStage = React.forwardRef(function ExportStage(
  { image, markers, opts, resolveIcon, defaultSize },
  ref
) {
  const showLegend = opts.includeLegend && markers.length > 0;
  const isStrip = opts.position === 'bottom-strip' || opts.position === 'right-strip';
  const isOverlay = showLegend && !isStrip;

  const ts = TEXT_SIZE_MAP[opts.textSize] || TEXT_SIZE_MAP.medium;

  // Layout: strip → container flex riga/colonna; overlay → legenda assoluta sopra immagine
  const wrapStyle = {
    display: 'flex',
    flexDirection: opts.position === 'right-strip' ? 'row' : 'column',
    background: '#ffffff',
  };

  return (
    <div ref={ref} style={wrapStyle}>
      {/* IMMAGINE + MARKER + eventuale OVERLAY */}
      <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
        <img
          src={image}
          alt=""
          style={{ display: 'block', maxWidth: '100%' }}
          crossOrigin="anonymous"
        />
        {markers.map((m, i) => {
          const Icon = resolveIcon(m.icon);
          const size = m.size || defaultSize;
          return (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: `${m.x}%`,
                top: `${m.y}%`,
                transform: 'translate(-50%, -50%)',
                color: m.color,
                // fontSize serve come fallback per browser che fanno cascade via em,
                // ma la dimensione reale dell'icona è forzata via prop `size` sotto.
                fontSize: size,
                lineHeight: 0,
                filter: 'drop-shadow(1px 1px 0 rgba(0,0,0,0.5))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Passiamo size esplicitamente: react-icons genera SVG
                  con attributi width/height in pixel assoluti, più affidabili
                  per html-to-image rispetto al cascade `1em`. */}
              <Icon size={size} />
              <span style={{
                position: 'absolute',
                top: -8,
                right: -8,
                background: '#fdfbf6',
                color: '#1a1612',
                border: '1.5px solid #1a1612',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1,
                filter: 'none',
              }}>
                {i + 1}
              </span>
            </div>
          );
        })}

        {/* Legenda in overlay */}
        {isOverlay && (
          <LegendBlock
            markers={markers}
            resolveIcon={resolveIcon}
            ts={ts}
            overlayPosition={opts.position}
            background={opts.background}
          />
        )}
      </div>

      {/* Legenda in strip esterna */}
      {showLegend && isStrip && (
        <LegendBlock
          markers={markers}
          resolveIcon={resolveIcon}
          ts={ts}
          stripMode={opts.position}
          background="solid"
        />
      )}
    </div>
  );
});

// ============================================================
// LEGEND BLOCK — usato sia in overlay che in strip
// ============================================================
function LegendBlock({ markers, resolveIcon, ts, overlayPosition, stripMode, background }) {
  const isStrip = !!stripMode;

  // Stili comuni
  const bg = background === 'transparent'
    ? 'rgba(253, 251, 246, 0.88)'
    : '#fdfbf6';

  const baseStyle = {
    background: bg,
    border: '1.5px solid #1a1612',
    boxShadow: isStrip ? 'none' : '3px 3px 0 #1a1612',
    padding: ts.pad,
    fontFamily: "'Inter', sans-serif",
    color: '#1a1612',
    display: 'flex',
    flexDirection: 'column',
    gap: ts.gap,
    boxSizing: 'border-box',
  };

  // Overlay: posizionato assoluto su un angolo
  if (!isStrip) {
    const margin = 16;
    const overlayStyle = {
      ...baseStyle,
      position: 'absolute',
      maxWidth: '42%',
      maxHeight: `calc(100% - ${margin * 2}px)`,
      overflow: 'hidden',
      backdropFilter: background === 'transparent' ? 'blur(2px)' : 'none',
    };
    if (overlayPosition === 'top-left')     { overlayStyle.top = margin;    overlayStyle.left = margin; }
    if (overlayPosition === 'top-right')    { overlayStyle.top = margin;    overlayStyle.right = margin; }
    if (overlayPosition === 'bottom-left')  { overlayStyle.bottom = margin; overlayStyle.left = margin; }
    if (overlayPosition === 'bottom-right') { overlayStyle.bottom = margin; overlayStyle.right = margin; }

    return (
      <div style={overlayStyle}>
        <LegendTitle ts={ts} />
        <LegendItems markers={markers} resolveIcon={resolveIcon} ts={ts} compact />
      </div>
    );
  }

  // Strip modes
  if (stripMode === 'bottom-strip') {
    return (
      <div style={{
        ...baseStyle,
        borderTop: 'none',
        width: '100%',
      }}>
        <LegendTitle ts={ts} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: ts.gap,
        }}>
          <LegendItems markers={markers} resolveIcon={resolveIcon} ts={ts} />
        </div>
      </div>
    );
  }

  // right-strip
  return (
    <div style={{
      ...baseStyle,
      borderLeft: 'none',
      width: 320,
      minHeight: '100%',
    }}>
      <LegendTitle ts={ts} />
      <LegendItems markers={markers} resolveIcon={resolveIcon} ts={ts} />
    </div>
  );
}

function LegendTitle({ ts }) {
  return (
    <div style={{
      fontFamily: "'Fraunces', serif",
      fontWeight: 800,
      fontStyle: 'italic',
      fontSize: ts.label + 8,
      letterSpacing: '-0.02em',
      lineHeight: 1,
      marginBottom: ts.gap,
      paddingBottom: ts.gap,
      borderBottom: '1px dashed rgba(26,22,18,0.3)',
    }}>
      Legenda
    </div>
  );
}

function LegendItems({ markers, resolveIcon, ts, compact }) {
  return (
    <>
      {markers.map((m, i) => {
        const Icon = resolveIcon(m.icon);
        return (
          <div key={m.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: ts.gap,
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: ts.desc,
              fontWeight: 600,
              color: '#5a5048',
              minWidth: 18,
              paddingTop: 2,
            }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{
              width: ts.icon + 10,
              height: ts.icon + 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #1a1612',
              background: '#ffffff',
              color: m.color,
              fontSize: ts.icon,
              lineHeight: 0,
              flexShrink: 0,
            }}>
              <Icon size={ts.icon} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
                fontSize: ts.label,
                lineHeight: 1.2,
                wordBreak: 'break-word',
              }}>
                {m.label}
              </div>
              {m.description && !compact && (
                <div style={{
                  fontSize: ts.desc,
                  color: '#5a5048',
                  lineHeight: 1.4,
                  marginTop: 2,
                  wordBreak: 'break-word',
                }}>
                  {m.description}
                </div>
              )}
              {m.description && compact && (
                <div style={{
                  fontSize: ts.desc,
                  color: '#5a5048',
                  lineHeight: 1.3,
                  marginTop: 2,
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {m.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
