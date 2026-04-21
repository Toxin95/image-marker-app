import { useState, useMemo, useEffect, useRef } from 'react';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import * as BiIcons from 'react-icons/bi';
import * as FiIcons from 'react-icons/fi';
import * as Io5Icons from 'react-icons/io5';
import * as LuIcons from 'react-icons/lu';
import { FaTimes, FaSearch } from 'react-icons/fa';

// ============ ICON SETS ============
// Ogni icona viene "etichettata" con il prefisso del suo set per distinguerle
const ICON_SETS = [
  { prefix: 'Fa', label: 'Font Awesome', module: FaIcons },
  { prefix: 'Md', label: 'Material Design', module: MdIcons },
  { prefix: 'Bi', label: 'Bootstrap', module: BiIcons },
  { prefix: 'Fi', label: 'Feather', module: FiIcons },
  { prefix: 'Io', label: 'Ionicons 5', module: Io5Icons },
  { prefix: 'Lu', label: 'Lucide', module: LuIcons },
];

// Costruiamo una volta sola l'indice completo: { name, setLabel, Component }
function buildIconIndex() {
  const index = [];
  for (const set of ICON_SETS) {
    for (const name of Object.keys(set.module)) {
      // Filtra solo export che iniziano con il prefisso del set (escludendo helpers)
      if (name.startsWith(set.prefix) && typeof set.module[name] === 'function') {
        index.push({
          name,
          setLabel: set.label,
          setPrefix: set.prefix,
          Component: set.module[name],
        });
      }
    }
  }
  return index;
}

const ICON_INDEX = buildIconIndex();

// ============ COMPONENT ============
export default function IconPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [setFilter, setSetFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(120);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Filtro con memoization
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ICON_INDEX.filter((i) => {
      if (setFilter !== 'all' && i.setPrefix !== setFilter) return false;
      if (!q) return true;
      // Rimuoviamo il prefisso dal nome per una ricerca più naturale
      const searchable = i.name.slice(i.setPrefix.length).toLowerCase();
      return searchable.includes(q) || i.name.toLowerCase().includes(q);
    });
  }, [query, setFilter]);

  // Reset paginazione quando cambia il filtro
  useEffect(() => {
    setVisibleCount(120);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [query, setFilter]);

  // Infinite scroll
  const handleScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisibleCount((c) => Math.min(c + 120, filtered.length));
    }
  };

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>

        <div className="picker-header">
          <div>
            <div className="panel-title">Libreria icone</div>
            <div className="panel-subtitle mono">
              {ICON_INDEX.length.toLocaleString()} icone disponibili · {filtered.length.toLocaleString()} risultati
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose}>
            <FaTimes /> Chiudi
          </button>
        </div>

        <div className="picker-controls">
          <div className="picker-search">
            <FaSearch />
            <input
              ref={inputRef}
              className="input"
              placeholder="Cerca un'icona (es. camera, tree, arrow...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="picker-sets">
            <button
              className={`btn btn-sm ${setFilter === 'all' ? 'btn-primary' : ''}`}
              onClick={() => setSetFilter('all')}
            >
              Tutti
            </button>
            {ICON_SETS.map((s) => (
              <button
                key={s.prefix}
                className={`btn btn-sm ${setFilter === s.prefix ? 'btn-primary' : ''}`}
                onClick={() => setSetFilter(s.prefix)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="picker-grid-wrap" ref={scrollRef} onScroll={handleScroll}>
          {visible.length === 0 ? (
            <div className="picker-empty">
              <div className="serif" style={{ fontSize: 24, fontStyle: 'italic', marginBottom: 8 }}>
                Nessun risultato
              </div>
              <div className="mono" style={{ color: 'var(--ink-soft)' }}>
                Prova con un termine diverso
              </div>
            </div>
          ) : (
            <div className="picker-grid">
              {visible.map(({ name, Component, setPrefix }) => (
                <button
                  key={name}
                  className="picker-cell"
                  onClick={() => onSelect(name, Component)}
                  title={name}
                >
                  <Component size={22} />
                  <span className="picker-cell-label">
                    {name.slice(setPrefix.length)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {visibleCount < filtered.length && (
            <div className="picker-loadmore mono">
              Mostrando {visibleCount} di {filtered.length.toLocaleString()} — scorri per vederne altre
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
