/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
import React, { useEffect, useState } from 'react';
import { distinctUntilChanged, map } from 'rxjs';

import type { UseEuiTheme } from '@elastic/eui';
import { EuiButtonEmpty, EuiFlexItem, EuiTitle } from '@elastic/eui';
import { css } from '@emotion/react';

import { useGridLayoutContext } from '../use_grid_layout_context';
import type { CollapsibleSection } from './types';

export const GridSectionTitle = React.memo(
  ({
    sectionId,
    toggleIsCollapsed,
    collapseButtonRef,
  }: {
    readOnly?: boolean;
    sectionId: string;
    editTitleOpen?: boolean;
    setEditTitleOpen?: (value: boolean) => void;
    toggleIsCollapsed: () => void;
    collapseButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  }) => {
    const { gridLayoutStateManager } = useGridLayoutContext();

    const currentSection = gridLayoutStateManager.gridLayout$.value[sectionId] as
      | CollapsibleSection
      | undefined;
    const [sectionTitle, setSectionTitle] = useState<string>(currentSection?.title ?? '');

    useEffect(() => {
      const titleSubscription = gridLayoutStateManager.gridLayout$
        .pipe(
          map((gridLayout) => {
            const section = gridLayout[sectionId];
            if (!section || section.isMainSection) return '';
            return section.title;
          }),
          distinctUntilChanged()
        )
        .subscribe((title) => {
          setSectionTitle(title);
        });

      return () => {
        titleSubscription.unsubscribe();
      };
    }, [sectionId, gridLayoutStateManager]);

    return (
      <EuiFlexItem grow={false} css={styles.titleButton}>
        <EuiButtonEmpty
          buttonRef={collapseButtonRef}
          color="text"
          aria-label={'Toggle collapse'}
          iconType={currentSection?.isCollapsed ? 'chevronSingleRight' : 'chevronSingleDown'}
          onClick={toggleIsCollapsed}
          size="m"
          id={`kbnGridSectionTitle-${sectionId}`}
          aria-controls={`kbnGridSection-${sectionId}`}
          aria-expanded={!currentSection?.isCollapsed}
          data-test-subj={`kbnGridSectionTitle-${sectionId}`}
          textProps={false}
          className={'kbnGridSectionTitle--button'}
          flush="both"
        >
          <EuiTitle size="xs" css={styles.mediumFontWeight}>
            <h2>{sectionTitle}</h2>
          </EuiTitle>
        </EuiButtonEmpty>
      </EuiFlexItem>
    );
  }
);

const styles = {
  titleButton: ({ euiTheme }: UseEuiTheme) =>
    css({
      minWidth: 0,
      button: {
        '&:focus': {
          backgroundColor: 'unset',
        },
        h2: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
        svg: {
          transition: `transform ${euiTheme.animation.fast} ease`,
          transform: 'rotate(0deg)',
          '.kbnGridSectionHeader--collapsed &': {
            transform: 'rotate(-90deg) !important',
          },
        },
      },
    }),
  mediumFontWeight: ({ euiTheme }: UseEuiTheme) => css`
    font-weight: ${euiTheme.font.weight.medium} !important;
  `,
};

GridSectionTitle.displayName = 'GridSectionTitle';
