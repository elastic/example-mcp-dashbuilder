/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface TimeRange {
  start: string;
  end: string;
}

interface TimeRangeContextValue {
  timeRange: TimeRange | null; // null = "all data"
  setTimeRange: (range: TimeRange | null) => void;
  refreshNonce: number;
  refreshData: () => void;
}

const TimeRangeContext = createContext<TimeRangeContextValue>({
  timeRange: null,
  setTimeRange: () => {},
  refreshNonce: 0,
  refreshData: () => {},
});

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refreshData = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ timeRange, setTimeRange, refreshNonce, refreshData }),
    [refreshData, refreshNonce, timeRange]
  );

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
