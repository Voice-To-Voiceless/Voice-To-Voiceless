import React from 'react';
import { ActionId, COMMUNICATION_ACTIONS } from '../../types/communication';

type Props = {
  status: string;
  error: string | null;
  statusVisible: boolean;
  emergencyPending: boolean;
  selectedAction: ActionId | null;
  selectedNoticeVisible: boolean;
};

export function BrowserToastStack(props: Props) {
  const selected = COMMUNICATION_ACTIONS.find(action => action.id === props.selectedAction);
  return <div className="toast-stack" aria-live="polite">
    {props.statusVisible && <section className="status-panel"><strong>{props.status}</strong>{props.error && <span>{props.error}</span>}</section>}
    {props.emergencyPending && <section className="confirmation-banner"><strong>Confirm emergency request</strong><span>Look at Emergency again or touch it to confirm.</span></section>}
    {selected && props.selectedNoticeVisible && <section className="selected-banner">Selected: <strong>{selected.label}</strong></section>}
  </div>;
}
