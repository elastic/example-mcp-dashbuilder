/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCallOut,
  EuiCheckbox,
  EuiCodeBlock,
  EuiDescriptionList,
  EuiEmptyPrompt,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiIcon,
  EuiLink,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiStat,
  EuiSwitch,
  EuiText,
  EuiTextArea,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import { defineRegistry, useBoundProp } from '@json-render/react';
import { jsonUiCatalog } from './catalog';

function toFlexJustify(
  value: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | null | undefined
): 'flexStart' | 'center' | 'flexEnd' | 'spaceBetween' | 'spaceAround' | undefined {
  switch (value) {
    case 'start':
      return 'flexStart';
    case 'end':
      return 'flexEnd';
    case 'center':
    case 'spaceBetween':
    case 'spaceAround':
      return value;
    case null:
    case undefined:
      return undefined;
    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}

function toFlexAlign(
  value: 'stretch' | 'start' | 'center' | 'end' | null | undefined
): 'stretch' | 'flexStart' | 'center' | 'flexEnd' | undefined {
  switch (value) {
    case 'start':
      return 'flexStart';
    case 'end':
      return 'flexEnd';
    case 'stretch':
    case 'center':
      return value;
    case null:
    case undefined:
      return undefined;
    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}

function toIconSize(size: 'xs' | 's' | 'm' | 'l' | 'xl' | null | undefined) {
  switch (size) {
    case 'xs':
      return 's';
    case 's':
    case 'm':
    case 'l':
    case 'xl':
      return size;
    case null:
    case undefined:
      return undefined;
    default: {
      const exhaustiveCheck: never = size;
      return exhaustiveCheck;
    }
  }
}

function renderTextColor(
  color: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'subdued' | null | undefined,
  theme: ReturnType<typeof useEuiTheme>['euiTheme']
): string | undefined {
  switch (color) {
    case 'primary':
      return theme.colors.primaryText;
    case 'success':
      return theme.colors.successText;
    case 'warning':
      return theme.colors.warningText;
    case 'danger':
      return theme.colors.dangerText;
    case 'subdued':
      return theme.colors.subduedText;
    case 'default':
    case null:
    case undefined:
      return undefined;
    default: {
      const exhaustiveCheck: never = color;
      return exhaustiveCheck;
    }
  }
}

const { registry } = defineRegistry(jsonUiCatalog, {
  components: {
    Panel: ({ props, children }) => (
      <EuiPanel
        hasBorder={props.hasBorder ?? true}
        paddingSize={props.padding ?? 'm'}
        color={props.color ?? 'plain'}
      >
        {props.title ? (
          <>
            <EuiTitle size="xs">
              <h3>{props.title}</h3>
            </EuiTitle>
            <EuiSpacer size="s" />
          </>
        ) : null}
        {children}
      </EuiPanel>
    ),
    FlexGroup: ({ props, children }) => (
      <EuiFlexGroup
        direction={props.direction ?? 'row'}
        gutterSize={props.gap === 'none' ? undefined : (props.gap ?? 'm')}
        justifyContent={toFlexJustify(props.justifyContent) ?? 'flexStart'}
        alignItems={toFlexAlign(props.alignItems) ?? 'stretch'}
        wrap={props.wrap ?? false}
      >
        {children}
      </EuiFlexGroup>
    ),
    FlexItem: ({ props, children }) => (
      <EuiFlexItem grow={props.grow ?? true}>{children}</EuiFlexItem>
    ),
    Spacer: ({ props }) => <EuiSpacer size={props.size ?? 'm'} />,
    HorizontalRule: ({ props }) => <EuiHorizontalRule margin={props.margin ?? 'm'} />,
    Title: ({ props }) => (
      <EuiTitle size={props.size ?? 'm'}>
        <h2>{props.content}</h2>
      </EuiTitle>
    ),
    Text: ({ props }) => {
      const { euiTheme } = useEuiTheme();
      return (
        <EuiText size={props.size ?? 'm'}>
          <p
            style={{
              color: renderTextColor(props.color, euiTheme),
              textAlign: props.align ?? 'left',
              margin: 0,
            }}
          >
            {props.content}
          </p>
        </EuiText>
      );
    },
    CodeBlock: ({ props }) => (
      <EuiCodeBlock language={props.language ?? undefined} fontSize="m" paddingSize="m" isCopyable>
        {props.code}
      </EuiCodeBlock>
    ),
    Button: ({ props, on }) => {
      const press = on('press');

      if (props.variant === 'empty' || props.variant === 'text') {
        return (
          <EuiButtonEmpty
            iconType={props.icon ?? undefined}
            size={props.size ?? 'm'}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              if (press.shouldPreventDefault) {
                event.preventDefault();
              }
              press.emit();
            }}
          >
            {props.label}
          </EuiButtonEmpty>
        );
      }

      return (
        <EuiButton
          iconType={props.icon ?? undefined}
          size={props.size ?? 'm'}
          color={props.variant === 'danger' ? 'danger' : 'primary'}
          fill={props.fill ?? props.variant !== 'secondary'}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            if (press.shouldPreventDefault) {
              event.preventDefault();
            }
            press.emit();
          }}
        >
          {props.label}
        </EuiButton>
      );
    },
    IconButton: ({ props, on }) => {
      const press = on('press');
      return (
        <EuiButtonIcon
          aria-label={props.label}
          iconType={props.icon}
          color={props.color === 'danger' ? 'danger' : 'text'}
          iconSize={props.size ?? 'm'}
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            if (press.shouldPreventDefault) {
              event.preventDefault();
            }
            press.emit();
          }}
        />
      );
    },
    LinkButton: ({ props, on }) => {
      const press = on('press');
      const href = press.bound ? undefined : (props.href ?? undefined);

      return (
        <EuiLink
          href={href}
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
            if (press.bound) {
              event.preventDefault();
              press.emit();
            }
          }}
        >
          {props.icon ? <EuiIcon type={props.icon} size="s" /> : null}
          <span style={{ marginLeft: props.icon ? 8 : 0 }}>{props.label}</span>
        </EuiLink>
      );
    },
    Badge: ({ props }) => (
      <EuiBadge
        color={props.color === 'default' ? 'hollow' : (props.color ?? 'hollow')}
        iconType={props.icon ?? undefined}
      >
        {props.label}
      </EuiBadge>
    ),
    Icon: ({ props }) => (
      <EuiIcon
        type={props.type}
        color={props.color === 'default' ? 'text' : (props.color ?? 'text')}
        size={toIconSize(props.size) ?? 'm'}
      />
    ),
    Callout: ({ props }) => (
      <EuiCallOut
        title={props.title}
        color={props.color ?? 'primary'}
        iconType={props.icon ?? undefined}
      >
        {props.description ? <p>{props.description}</p> : null}
      </EuiCallOut>
    ),
    LoadingIndicator: ({ props }) => <EuiLoadingSpinner size={props.size ?? 'l'} />,
    EmptyState: ({ props }) => (
      <EuiEmptyPrompt
        iconType={props.icon ?? undefined}
        title={<h2>{props.title}</h2>}
        body={props.body ? <p>{props.body}</p> : undefined}
      />
    ),
    TextInput: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp<string | null>(props.value, bindings?.value);
      return (
        <EuiFieldText
          aria-label={props.label ?? props.placeholder ?? 'Text input'}
          compressed={props.compressed ?? false}
          fullWidth
          value={value ?? ''}
          placeholder={props.placeholder ?? undefined}
          onChange={(event) => {
            setValue(event.target.value);
            emit('change');
          }}
        />
      );
    },
    TextArea: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp<string | null>(props.value, bindings?.value);
      return (
        <EuiTextArea
          aria-label={props.label ?? props.placeholder ?? 'Text area'}
          fullWidth
          value={value ?? ''}
          placeholder={props.placeholder ?? undefined}
          rows={props.rows ?? 4}
          onChange={(event) => {
            setValue(event.target.value);
            emit('change');
          }}
        />
      );
    },
    Checkbox: ({ props, bindings, emit }) => {
      const [checked, setChecked] = useBoundProp<boolean | null>(props.checked, bindings?.checked);
      return (
        <EuiCheckbox
          id={`checkbox-${props.label}`}
          label={props.label}
          checked={checked ?? false}
          onChange={(event) => {
            setChecked(event.target.checked);
            emit('change');
          }}
        />
      );
    },
    Switch: ({ props, bindings, emit }) => {
      const [checked, setChecked] = useBoundProp<boolean | null>(props.checked, bindings?.checked);
      return (
        <EuiSwitch
          label={props.label}
          checked={checked ?? false}
          onChange={(event) => {
            setChecked(event.target.checked);
            emit('change');
          }}
        />
      );
    },
    Select: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp<string | null>(props.value, bindings?.value);
      const options = props.placeholder
        ? [
            { value: '', text: props.placeholder },
            ...props.options.map((option) => ({ value: option.value, text: option.label })),
          ]
        : props.options.map((option) => ({ value: option.value, text: option.label }));

      return (
        <EuiSelect
          aria-label={props.label ?? props.placeholder ?? 'Select'}
          fullWidth
          value={value ?? ''}
          options={options}
          onChange={(event) => {
            setValue(event.target.value);
            emit('change');
          }}
        />
      );
    },
    ButtonGroup: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp<string | null>(props.value, bindings?.value);
      const selectedId = value ?? props.options[0]?.id ?? '';
      return (
        <EuiButtonGroup
          type="single"
          legend={props.legend ?? 'Select one'}
          options={props.options}
          idSelected={selectedId}
          buttonSize={props.size ?? 'm'}
          onChange={(nextValue) => {
            setValue(nextValue);
            emit('change');
          }}
        />
      );
    },
    KeyValueList: ({ props }) => (
      <EuiDescriptionList
        compressed
        listItems={props.items.map((item) => ({
          title: item.label,
          description:
            item.value === null
              ? '-'
              : typeof item.value === 'boolean'
                ? String(item.value)
                : item.value,
        }))}
      />
    ),
    StatTile: ({ props }) => (
      <EuiPanel hasBorder paddingSize="m">
        <EuiStat
          title={String(props.value)}
          description={props.title}
          titleColor={props.color === 'default' ? 'default' : (props.color ?? 'default')}
          textAlign="left"
        >
          {props.subtitle ? <p style={{ marginTop: 8 }}>{props.subtitle}</p> : null}
        </EuiStat>
      </EuiPanel>
    ),
    ListRow: ({ props }) => (
      <EuiPanel hasBorder paddingSize="s">
        <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
          <EuiFlexItem grow={false}>
            {props.icon ? <EuiIcon type={props.icon} size="m" /> : null}
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s">
              <strong>{props.title}</strong>
              {props.subtitle ? <p style={{ margin: 0 }}>{props.subtitle}</p> : null}
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            {props.badge ? <EuiBadge>{props.badge}</EuiBadge> : null}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    ),
  },
  actions: {
    sync_state: async () => {},
    reset_state: async () => {},
    refresh_ui: async () => {},
  },
});

export const jsonUiRegistry = registry;
