import React from 'react';
import type { AdminProvider } from '../services/adminTypes';

interface ProviderSidebarProps {
  providers: AdminProvider[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ProviderSidebar({ providers, selectedId, onSelect, onCreate }: ProviderSidebarProps) {
  return (
    <aside className="sidebar" aria-label="AI providers">
      <div className="sidebar-heading">
        <div>
          <p className="eyebrow">Control plane</p>
          <h1>Providers</h1>
        </div>
        <button className="button button-primary" type="button" onClick={onCreate}>
          Add provider
        </button>
      </div>
      <nav aria-label="Provider list">
        <ul className="provider-list">
          {providers.map((provider) => (
            <li key={provider.id}>
              <button
                className={`provider-option${selectedId === provider.id ? ' selected' : ''}`}
                type="button"
                aria-current={selectedId === provider.id ? 'page' : undefined}
                onClick={() => onSelect(provider.id)}
              >
                <span>{provider.displayMetadata?.label ?? provider.name}</span>
                <small>{provider.protocol}</small>
                <span className={`state-dot state-${provider.state}`}>{provider.state}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
