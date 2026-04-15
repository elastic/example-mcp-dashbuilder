/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { ComponentProps } from 'react';
import { EuiProvider } from '@elastic/eui';

type EuiProviderModify = NonNullable<ComponentProps<typeof EuiProvider>['modify']>;

const NEUTRAL_DARK_BACKGROUND = '#141414';
const NEUTRAL_DARK_SECONDARY = '#181818';
const NEUTRAL_DARK_BUTTON = '#2a2a2a';
const NEUTRAL_DARK_BUTTON_HOVER = '#333333';
const NEUTRAL_DARK_BUTTON_ACTIVE = '#3a3a3a';
const NEUTRAL_DARK_BUTTON_BORDER = '#4a4a4a';

export const NEUTRAL_DARK_EUI_MODIFY: EuiProviderModify = {
  colors: {
    DARK: {
      body: NEUTRAL_DARK_BACKGROUND,
      emptyShade: NEUTRAL_DARK_SECONDARY,
      lightestShade: NEUTRAL_DARK_SECONDARY,
      lightShade: '#303744',
      mediumShade: '#A9B1BD',
      darkShade: '#C9D1D9',
      darkestShade: '#F5F7FA',
      fullShade: '#FFFFFF',
      primary: '#9CA3AF',
      primaryText: '#D1D5DB',
      text: '#F5F7FA',
      link: '#D1D5DB',
      title: '#F5F7FA',
      subduedText: '#A9B1BD',
      textPrimary: '#D1D5DB',
      textParagraph: '#F5F7FA',
      textHeading: '#F5F7FA',
      textSubdued: '#A9B1BD',
      backgroundBasePrimary: NEUTRAL_DARK_SECONDARY,
      backgroundBaseSubdued: NEUTRAL_DARK_BACKGROUND,
      backgroundBasePlain: NEUTRAL_DARK_SECONDARY,
      backgroundBaseInteractiveHover: '#22272F',
      backgroundBaseInteractiveSelect: '#252B34',
      backgroundBaseInteractiveSelectHover: '#2B313B',
      shadow: '#000000',
    },
  },
  border: {
    color: '#303744',
  },
};

export const NEUTRAL_DARK_GLOBAL_CSS = `
  :root {
    color-scheme: dark;
  }

  html,
  body,
  #root,
  .euiBody-hasPortalContent {
    background-color: ${NEUTRAL_DARK_BACKGROUND};
    scrollbar-color: rgba(201, 209, 217, 0.55) ${NEUTRAL_DARK_BACKGROUND};
  }

  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  #root::-webkit-scrollbar,
  .euiBody-hasPortalContent::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  html::-webkit-scrollbar-thumb,
  body::-webkit-scrollbar-thumb,
  #root::-webkit-scrollbar-thumb,
  .euiBody-hasPortalContent::-webkit-scrollbar-thumb {
    background-color: rgba(201, 209, 217, 0.55);
    background-clip: content-box;
    border: 3px solid ${NEUTRAL_DARK_BACKGROUND};
    border-radius: 12px;
  }

  html::-webkit-scrollbar-track,
  html::-webkit-scrollbar-corner,
  body::-webkit-scrollbar-track,
  body::-webkit-scrollbar-corner,
  #root::-webkit-scrollbar-track,
  #root::-webkit-scrollbar-corner,
  .euiBody-hasPortalContent::-webkit-scrollbar-track,
  .euiBody-hasPortalContent::-webkit-scrollbar-corner {
    background-color: ${NEUTRAL_DARK_BACKGROUND};
  }

  .euiSuperDatePicker .euiFormControlLayout__childrenWrapper {
    color: #f5f7fa !important;
    background-color: ${NEUTRAL_DARK_SECONDARY} !important;
    box-shadow: inset 0 0 0 1px #303744 !important;
  }

  .euiSuperDatePicker .euiFormControlLayout__childrenWrapper:hover {
    outline: 1px solid #404958;
    outline-offset: -1px;
  }

  .euiSuperDatePicker .euiFormControlLayout__childrenWrapper:focus-within,
  .euiSuperDatePicker .euiPopover-isOpen .euiFormControlLayout__childrenWrapper {
    box-shadow: inset 0 0 0 2px #4b5563 !important;
  }

  .euiSuperDatePicker .euiDatePopoverButton,
  .euiSuperDatePicker .euiButtonEmpty {
    color: #f5f7fa !important;
  }

  .euiSuperDatePicker .euiDatePopoverButton:hover,
  .euiSuperDatePicker .euiButtonEmpty:hover {
    background-color: ${NEUTRAL_DARK_SECONDARY} !important;
  }

  .euiSuperDatePicker .euiDatePopoverButton-isSelected {
    background-color: #252b34 !important;
  }

  .euiSuperDatePicker [data-test-subj='superDatePickerToggleQuickMenuButton'] {
    color: #f5f7fa !important;
    background-color: ${NEUTRAL_DARK_SECONDARY} !important;
    box-shadow: inset 0 0 0 1px #303744 !important;
  }

  .euiSuperDatePicker [data-test-subj='superDatePickerToggleQuickMenuButton']::before {
    background-color: transparent !important;
  }

  .euiSuperDatePicker [data-test-subj='superDatePickerToggleQuickMenuButton']:hover,
  .euiSuperDatePicker [data-test-subj='superDatePickerToggleQuickMenuButton'][aria-expanded='true'] {
    color: #f5f7fa !important;
    background-color: ${NEUTRAL_DARK_SECONDARY} !important;
    box-shadow: inset 0 0 0 1px #404040 !important;
  }

  .euiQuickSelectPopover [data-test-subj='superDatePickerQuickSelectApplyButton'] {
    color: #f5f7fa !important;
    background-color: ${NEUTRAL_DARK_BUTTON} !important;
    border-color: ${NEUTRAL_DARK_BUTTON_BORDER} !important;
  }

  .euiQuickSelectPopover [data-test-subj='superDatePickerQuickSelectApplyButton']:hover {
    background-color: ${NEUTRAL_DARK_BUTTON_HOVER} !important;
    border-color: ${NEUTRAL_DARK_BUTTON_BORDER} !important;
  }

  .euiQuickSelectPopover [data-test-subj='superDatePickerQuickSelectApplyButton']:active {
    background-color: ${NEUTRAL_DARK_BUTTON_ACTIVE} !important;
    border-color: ${NEUTRAL_DARK_BUTTON_BORDER} !important;
  }
`;
