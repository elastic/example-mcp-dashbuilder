/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { createContext, useContext, useState, useMemo } from 'react';

export interface TimeRange {
  start: string;
  end: string;
}

interface TimeRangeContextValue {
  timeRange: TimeRange | null; // null = "all data"
  setTimeRange: (range: TimeRange | null) => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue>({
  timeRange: null,
  setTimeRange: () => {},
});

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);

  const value = useMemo(() => ({ timeRange, setTimeRange }), [timeRange]);

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
