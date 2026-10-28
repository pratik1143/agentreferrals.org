import { useId, useMemo, useState } from 'react';
import './combobox.css';

const normalize = option => typeof option === 'string' ? { value: option, label: option } : option;

// Ranks options for a typed query: exact, then prefix, then word prefix, then contains.
const rank = (option, query) => {
  const haystacks = [option.label, option.value, option.keywords].filter(Boolean).map(item => String(item).toLowerCase());
  if (haystacks.some(item => item === query)) return 0;
  if (haystacks.some(item => item.startsWith(query))) return 1;
  if (haystacks.some(item => item.split(/[\s-]+/).some(word => word.startsWith(query)))) return 2;
  if (haystacks.some(item => item.includes(query))) return 3;
  return -1;
};

// Text input with a suggestion dropdown. Typing calls onInput; picking a suggestion calls onSelect.
export default function Combobox({ id, value, onInput, onSelect, options = [], placeholder, disabled = false, invalid = false, emptyText = '', maxResults = 8, autoComplete = 'off', ariaLabel }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = String(value || '').trim().toLowerCase();

  const results = useMemo(() => {
    const all = options.map(normalize);
    if (!query) return all.slice(0, maxResults);
    return all
      .map(option => ({ option, score: rank(option, query) }))
      .filter(item => item.score >= 0)
      .sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label))
      .slice(0, maxResults)
      .map(item => item.option);
  }, [options, query, maxResults]);

  const choose = option => { onSelect?.(option.value, option); setOpen(false); };
  const showList = open && !disabled && (results.length > 0 || (emptyText && query));

  const onKeyDown = event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    else if (event.key === 'Enter' && open && results[active]) { event.preventDefault(); choose(results[active]); }
    else if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
  };

  return (
    <div className="cbx">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={Boolean(showList)}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        value={value || ''}
        onChange={event => { onInput?.(event.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="cbx-list" id={listId} role="listbox">
          {results.length ? results.map((option, index) => (
            <li
              key={`${option.value}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={event => { event.preventDefault(); choose(option); }}
              onMouseEnter={() => setActive(index)}
            >
              <span>{option.label}</span>{option.hint && <small>{option.hint}</small>}
            </li>
          )) : <li className="cbx-empty" aria-disabled="true">{emptyText}</li>}
        </ul>
      )}
    </div>
  );
}
