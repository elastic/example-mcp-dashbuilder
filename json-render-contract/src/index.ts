/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { ActionBindingSchema, defineCatalog, type Spec } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const SIZE_SCHEMA = z.enum(['xs', 's', 'm', 'l', 'xl']);
const GAP_SCHEMA = z.enum(['none', 'xs', 's', 'm', 'l', 'xl']);
const ALIGN_SCHEMA = z.enum(['left', 'center', 'right']);
const JUSTIFY_SCHEMA = z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround']);
const FLEX_ALIGN_SCHEMA = z.enum(['stretch', 'start', 'center', 'end']);
const BUTTON_VARIANT_SCHEMA = z.enum(['primary', 'secondary', 'empty', 'danger', 'text']);
const STATUS_COLOR_SCHEMA = z.enum([
  'default',
  'primary',
  'success',
  'warning',
  'danger',
  'subdued',
]);
const ICON_SCHEMA = z.enum([
  'arrowDown',
  'arrowLeft',
  'arrowRight',
  'arrowUp',
  'calendar',
  'check',
  'clock',
  'cross',
  'dot',
  'grab',
  'help',
  'iInCircle',
  'minusInCircle',
  'plus',
  'refresh',
  'trash',
  'warning',
]);

const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const buttonGroupOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const keyValueItemSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
});

export const JSON_UI_ACTION_NAME_SCHEMA = z.enum(['sync_state', 'reset_state', 'refresh_ui']);
export type JsonUiActionName = z.infer<typeof JSON_UI_ACTION_NAME_SCHEMA>;

export type JsonUiState = Record<string, unknown>;
export type JsonUiSpec = Spec;

const rawElementSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()),
  visible: z.unknown().optional(),
  on: z.record(z.string(), z.union([ActionBindingSchema, z.array(ActionBindingSchema)])).optional(),
  repeat: z
    .object({
      statePath: z.string(),
      key: z.string().optional(),
    })
    .optional(),
});

const rawSpecSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), rawElementSchema),
  state: z.record(z.string(), z.unknown()).optional(),
});

const jsonUiCatalogConfig = {
  components: {
    Panel: {
      props: z.object({
        title: z.string().nullable(),
        padding: SIZE_SCHEMA.nullable(),
        color: z.enum(['transparent', 'plain', 'subdued']).nullable(),
        hasBorder: z.boolean().nullable(),
      }),
      slots: ['default'],
      description: 'A bordered container for grouping content with optional title and padding.',
    },
    FlexGroup: {
      props: z.object({
        direction: z.enum(['row', 'column']).nullable(),
        gap: GAP_SCHEMA.nullable(),
        justifyContent: JUSTIFY_SCHEMA.nullable(),
        alignItems: FLEX_ALIGN_SCHEMA.nullable(),
        wrap: z.boolean().nullable(),
      }),
      slots: ['default'],
      description:
        'A flex layout container for arranging child elements horizontally or vertically.',
    },
    FlexItem: {
      props: z.object({
        grow: z.boolean().nullable(),
      }),
      slots: ['default'],
      description: 'A flex child used inside FlexGroup to control growth.',
    },
    Spacer: {
      props: z.object({
        size: SIZE_SCHEMA.nullable(),
      }),
      description: 'Adds vertical space between blocks.',
    },
    HorizontalRule: {
      props: z.object({
        margin: SIZE_SCHEMA.nullable(),
      }),
      description: 'A horizontal divider between sections of content.',
    },
    Title: {
      props: z.object({
        content: z.string(),
        size: z.enum(['xs', 's', 'm', 'l']).nullable(),
      }),
      description: 'A heading used for titles and section labels.',
    },
    Text: {
      props: z.object({
        content: z.string(),
        size: z.enum(['s', 'm', 'relative']).nullable(),
        color: STATUS_COLOR_SCHEMA.nullable(),
        align: ALIGN_SCHEMA.nullable(),
      }),
      description: 'Body text for descriptions, labels, and supporting copy.',
    },
    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().nullable(),
      }),
      description: 'A formatted block for code snippets or structured text.',
    },
    Button: {
      props: z.object({
        label: z.string(),
        variant: BUTTON_VARIANT_SCHEMA.nullable(),
        size: z.enum(['s', 'm']).nullable(),
        fill: z.boolean().nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'A standard action button that can trigger bound actions.',
    },
    IconButton: {
      props: z.object({
        label: z.string(),
        icon: ICON_SCHEMA,
        color: STATUS_COLOR_SCHEMA.nullable(),
        size: z.enum(['s', 'm']).nullable(),
      }),
      description: 'A compact icon-first button for secondary actions.',
    },
    LinkButton: {
      props: z.object({
        label: z.string(),
        href: z.string().nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'A button styled like a link for lightweight navigation or actions.',
    },
    Badge: {
      props: z.object({
        label: z.string(),
        color: STATUS_COLOR_SCHEMA.nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'A small status badge for tags, state, or categorization.',
    },
    Icon: {
      props: z.object({
        type: ICON_SCHEMA,
        color: STATUS_COLOR_SCHEMA.nullable(),
        size: SIZE_SCHEMA.nullable(),
      }),
      description: 'A standalone icon for status, decoration, or emphasis.',
    },
    Callout: {
      props: z.object({
        title: z.string(),
        description: z.string().nullable(),
        color: z.enum(['primary', 'success', 'warning', 'danger']).nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'A highlighted message box for information, warnings, and errors.',
    },
    LoadingIndicator: {
      props: z.object({
        size: z.enum(['m', 'l', 'xl']).nullable(),
      }),
      description: 'A loading spinner for pending content or in-flight actions.',
    },
    EmptyState: {
      props: z.object({
        title: z.string(),
        body: z.string().nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'An empty-state block for zero data, onboarding, or instructional states.',
    },
    TextInput: {
      props: z.object({
        label: z.string().nullable(),
        value: z.string().nullable(),
        placeholder: z.string().nullable(),
        helpText: z.string().nullable(),
        compressed: z.boolean().nullable(),
      }),
      description: 'A single-line text input that supports local state binding.',
    },
    TextArea: {
      props: z.object({
        label: z.string().nullable(),
        value: z.string().nullable(),
        placeholder: z.string().nullable(),
        helpText: z.string().nullable(),
        rows: z.number().int().min(2).max(12).nullable(),
      }),
      description: 'A multi-line text area that supports local state binding.',
    },
    Checkbox: {
      props: z.object({
        label: z.string(),
        checked: z.boolean().nullable(),
        helpText: z.string().nullable(),
      }),
      description: 'A checkbox input for boolean choices.',
    },
    Switch: {
      props: z.object({
        label: z.string(),
        checked: z.boolean().nullable(),
        helpText: z.string().nullable(),
      }),
      description: 'A switch control for boolean toggles.',
    },
    Select: {
      props: z.object({
        label: z.string().nullable(),
        value: z.string().nullable(),
        placeholder: z.string().nullable(),
        helpText: z.string().nullable(),
        options: z.array(optionSchema),
      }),
      description: 'A select menu for choosing one option from a short list.',
    },
    ButtonGroup: {
      props: z.object({
        legend: z.string().nullable(),
        value: z.string().nullable(),
        options: z.array(buttonGroupOptionSchema),
        size: z.enum(['compressed', 's', 'm']).nullable(),
      }),
      description: 'A single-select button group for radio-style choices.',
    },
    KeyValueList: {
      props: z.object({
        items: z.array(keyValueItemSchema),
      }),
      description: 'A compact list of key and value pairs.',
    },
    StatTile: {
      props: z.object({
        title: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        subtitle: z.string().nullable(),
        color: STATUS_COLOR_SCHEMA.nullable(),
      }),
      description: 'A compact metric tile for a single highlighted value.',
    },
    ListRow: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        badge: z.string().nullable(),
        icon: ICON_SCHEMA.nullable(),
      }),
      description: 'A single repeated row with optional subtitle, badge, and icon.',
    },
  },
  actions: {
    sync_state: {
      params: z.object({
        message: z.string().nullable(),
      }),
      description: 'Persist the current local state back to the server snapshot.',
    },
    reset_state: {
      params: z.object({}),
      description: 'Reset local and server state back to the original snapshot state.',
    },
    refresh_ui: {
      params: z.object({}),
      description: 'Reload the current snapshot from the server and refresh the rendered UI.',
    },
  },
  functions: {},
};

export const jsonUiCatalog = defineCatalog(schema, jsonUiCatalogConfig);

export interface JsonUiDocument {
  spec: JsonUiSpec;
  initialState: JsonUiState;
}

function isStateRecord(value: unknown): value is JsonUiState {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeProps(shape: z.ZodObject<z.ZodRawShape>): string {
  return Object.keys(shape.shape)
    .sort()
    .map((key) => `\`${key}\``)
    .join(', ');
}

export function parseJsonUiSpec(spec: unknown): JsonUiSpec {
  const rawSpec = rawSpecSchema.parse(spec);
  const parsed = jsonUiCatalog.validate(spec);
  if (!parsed.success) {
    throw parsed.error;
  }
  const validatedSpec = parsed.data as JsonUiSpec;

  const normalizedSpec: JsonUiSpec = {
    root: validatedSpec.root,
    elements: Object.fromEntries(
      Object.entries(validatedSpec.elements).map(([elementId, element]) => {
        const rawElement = rawSpec.elements[elementId];
        return [
          elementId,
          {
            ...element,
            ...(rawElement?.on ? { on: rawElement.on } : {}),
            ...(rawElement?.repeat ? { repeat: rawElement.repeat } : {}),
          },
        ] as const;
      })
    ) as JsonUiSpec['elements'],
    ...(rawSpec.state ? { state: rawSpec.state } : {}),
  };

  return normalizedSpec;
}

export function buildJsonUiDocument(spec: unknown, initialState?: JsonUiState): JsonUiDocument {
  const rawSpecState =
    typeof spec === 'object' && spec !== null && 'state' in spec && isStateRecord(spec.state)
      ? spec.state
      : {};
  const parsedSpec = parseJsonUiSpec(spec);
  const resolvedState = initialState ?? rawSpecState;

  return {
    spec: parsedSpec,
    initialState: resolvedState,
  };
}

export function buildJsonRenderCatalogResource(): string {
  const componentEntries = Object.entries(jsonUiCatalog.data.components) as Array<
    [
      string,
      {
        props: z.ZodObject<z.ZodRawShape>;
        description?: string;
      },
    ]
  >;
  const actionEntries = Object.entries(jsonUiCatalog.data.actions) as Array<
    [
      string,
      {
        description?: string;
      },
    ]
  >;

  const componentLines = componentEntries
    .map(([name, definition]) => {
      const props = describeProps(definition.props);
      return `### \`${name}\`\n- ${definition.description}\n- Props: ${props || 'none'}\n`;
    })
    .join('\n');

  const actionLines = actionEntries
    .map(([name, definition]) => `- \`${name}\`: ${definition.description}`)
    .join('\n');

  const prompt = jsonUiCatalog.prompt({
    customRules: [
      'Use only the components and actions defined in this catalog.',
      'Prefer small, task-focused UIs over full application shells.',
      'Use repeat and bindings instead of hardcoding duplicate blocks.',
      'Do not assume unsupported components, actions, or computed functions exist.',
    ],
    mode: 'generate',
  });

  return `# json-render Catalog

Use this catalog when generating schema-driven UI for the MCP app.

## Components

${componentLines}
## App-backed Actions

${actionLines}

## Generation Prompt

\`\`\`text
${prompt}
\`\`\`
`;
}

export function buildJsonRenderSchemaResource(): string {
  return `# json-render Schema

This schema is generated from the shared contract package and is the source of truth for spec validation.

\`\`\`json
${JSON.stringify(jsonUiCatalog.jsonSchema(), null, 2)}
\`\`\`
`;
}

export function buildJsonRenderBindingResource(): string {
  return `# json-render Binding Reference

This MCP app currently supports a curated subset of json-render features. Generate only the bindings documented here.

## Supported now

- \`$state\`: read values from the state model using JSON Pointer paths
- \`visible\`: show or hide elements from state conditions
- \`$template\`: interpolate strings from state values
- \`repeat\`, \`$item\`, \`$index\`: render repeated rows and cards from arrays
- \`$bindState\`: two-way bind curated form props such as \`value\` and \`checked\`

## App-backed actions

- \`sync_state\`: persist the current renderer state back to the server snapshot
- \`reset_state\`: restore the snapshot state to its original value
- \`refresh_ui\`: reload the current payload from the server

## Deferred for later phases

- \`$bindItem\`
- \`$cond\`
- \`$computed\`
- validation providers
- arbitrary or free-form server actions

## Guidance

- Prefer \`$state\` for read-only content and \`$bindState\` only on natural form props.
- Use \`repeat\` for repeated cards or rows rather than manually duplicating elements.
- Keep specs small and focused on one task or panel of information.
- Do not generate actions outside the allowlisted app-backed actions above.
`;
}
