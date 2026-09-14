import React from 'react';
import { ActionId, COMMUNICATION_ACTIONS } from '../../types/communication';

type Props = {
  boardRef: React.RefObject<HTMLDivElement | null>;
  selectedAction: ActionId | null;
  activeTarget: ActionId | null;
  dwellProgress: number;
  onSelect: (action: ActionId) => void;
};

export function BrowserActionBoard({ boardRef, selectedAction, activeTarget, dwellProgress, onSelect }: Props) {
  return <section ref={boardRef} className="board-section">
    <div className="section-heading"><h2>Common needs</h2><span>Look or touch a choice</span></div>
    <div className={`action-grid ${activeTarget ? 'has-gaze-target' : ''}`}>
      {COMMUNICATION_ACTIONS.map(action => {
        const active = activeTarget === action.id;
        const selected = selectedAction === action.id;
        return <button key={action.id} type="button" data-action-id={action.id} aria-pressed={selected}
          className={`action-card ${action.tone} ${active ? 'gaze-active' : ''} ${selected ? 'selected' : ''}`}
          onClick={() => onSelect(action.id)}>
          <span className="action-label">{action.label}</span><span className="action-description">{action.description}</span>
          {selected && <span className="selected-marker">Chosen</span>}
          {active && <span className="dwell-progress" style={{ width: `${dwellProgress * 100}%` }} />}
        </button>;
      })}
    </div>
  </section>;
}
