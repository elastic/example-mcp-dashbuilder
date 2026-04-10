/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Scroll container utilities for the grid layout.
 * Uses document.documentElement as the scroll container.
 */

export type ScrollContainer = HTMLElement;

export const getScrollContainer = (): ScrollContainer => {
  return document.documentElement;
};

export const getScrollPosition = (container: ScrollContainer = getScrollContainer()): number => {
  return container.scrollTop;
};

export const scrollTo = (
  opts: { top: number; behavior?: ScrollBehavior },
  container: ScrollContainer = getScrollContainer()
) => {
  container.scrollTo({ top: opts.top, behavior: opts.behavior });
};

export const scrollBy = (
  opts: { top: number; behavior?: ScrollBehavior },
  container: ScrollContainer = getScrollContainer()
) => {
  container.scrollBy({ top: opts.top, behavior: opts.behavior });
};

export const getScrollDimensions = (
  container: ScrollContainer = getScrollContainer()
): { scrollTop: number; scrollHeight: number; clientHeight: number } => {
  return {
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    clientHeight: container.clientHeight,
  };
};

export const getViewportHeight = (container: ScrollContainer = getScrollContainer()): number => {
  return container.clientHeight;
};

export const isAtBottomOfPage = (container: ScrollContainer = getScrollContainer()): boolean => {
  const { scrollTop, scrollHeight, clientHeight } = getScrollDimensions(container);
  return scrollHeight - clientHeight - scrollTop <= 1;
};
