/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EuiProvider } from '@elastic/eui';
import { createStateStore, JSONUIProvider, Renderer, type Spec } from '@json-render/react';
import { jsonUiRegistry } from './registry';

function renderJsonUi(spec: Spec, initialState: Record<string, unknown> = {}) {
  const store = createStateStore(initialState);

  render(
    <EuiProvider colorMode="light">
      <JSONUIProvider registry={jsonUiRegistry} store={store}>
        <Renderer spec={spec} registry={jsonUiRegistry} />
      </JSONUIProvider>
    </EuiProvider>
  );

  return { store };
}

describe('jsonUiRegistry', () => {
  it('respects visibility conditions for read-only content', () => {
    renderJsonUi(
      {
        root: 'root',
        elements: {
          root: {
            type: 'Panel',
            props: { title: 'Visibility' },
            children: ['visible', 'hidden'],
          },
          visible: {
            type: 'Text',
            props: { content: 'Visible text' },
            children: [],
          },
          hidden: {
            type: 'Text',
            props: { content: 'Hidden text' },
            visible: { $state: '/flags/showHidden' },
            children: [],
          },
        },
      },
      { flags: { showHidden: false } }
    );

    expect(screen.getByText('Visible text')).toBeInTheDocument();
    expect(screen.queryByText('Hidden text')).not.toBeInTheDocument();
  });

  it('renders repeated rows from array state', () => {
    renderJsonUi(
      {
        root: 'root',
        elements: {
          root: {
            type: 'Panel',
            props: { title: 'Rows' },
            children: ['rows'],
          },
          rows: {
            type: 'FlexGroup',
            props: { direction: 'column' },
            repeat: { statePath: '/items', key: 'id' },
            children: ['row'],
          },
          row: {
            type: 'ListRow',
            props: { title: { $item: 'label' } },
            children: [],
          },
        },
      },
      {
        items: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ],
      }
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('writes through $bindState for curated form controls', () => {
    const { store } = renderJsonUi(
      {
        root: 'root',
        elements: {
          root: {
            type: 'Panel',
            props: { title: 'Form' },
            children: ['input'],
          },
          input: {
            type: 'TextInput',
            props: {
              value: { $bindState: '/form/name' },
              placeholder: 'Name',
            },
            children: [],
          },
        },
      },
      { form: { name: 'Alice' } }
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } });

    expect(store.get('/form/name')).toBe('Bob');
  });
});
