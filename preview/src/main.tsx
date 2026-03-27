import React from 'react';
import ReactDOM from 'react-dom/client';
import { EuiProvider } from '@elastic/eui';
import { App } from './App';

import '@elastic/charts/dist/theme_light.css';

// Pre-cache icons used by kbn-grid-layout and EuiSuperDatePicker
import { appendIconComponentCache } from '@elastic/eui/es/components/icon/icon';
import { icon as arrowDown } from '@elastic/eui/es/components/icon/assets/arrow_down';
import { icon as arrowLeft } from '@elastic/eui/es/components/icon/assets/arrow_left';
import { icon as arrowRight } from '@elastic/eui/es/components/icon/assets/arrow_right';
import { icon as arrowUp } from '@elastic/eui/es/components/icon/assets/arrow_up';
import { icon as calendar } from '@elastic/eui/es/components/icon/assets/calendar';
import { icon as chevronSingleDown } from '@elastic/eui/es/components/icon/assets/chevron_single_down';
import { icon as chevronSingleRight } from '@elastic/eui/es/components/icon/assets/chevron_single_right';
import { icon as clock } from '@elastic/eui/es/components/icon/assets/clock';
import { icon as cross } from '@elastic/eui/es/components/icon/assets/cross';
import { icon as grab } from '@elastic/eui/es/components/icon/assets/grab';
import { icon as grabOmnidirectional } from '@elastic/eui/es/components/icon/assets/grab_omnidirectional';
import { icon as move } from '@elastic/eui/es/components/icon/assets/move';
import { icon as pencil } from '@elastic/eui/es/components/icon/assets/pencil';
import { icon as plus } from '@elastic/eui/es/components/icon/assets/plus';
import { icon as popout } from '@elastic/eui/es/components/icon/assets/popout';
import { icon as refresh } from '@elastic/eui/es/components/icon/assets/refresh';
import { icon as trash } from '@elastic/eui/es/components/icon/assets/trash';
import { icon as warning } from '@elastic/eui/es/components/icon/assets/warning';

appendIconComponentCache({
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
  calendar,
  chevronSingleDown,
  chevronSingleRight,
  clock,
  cross,
  grab,
  grabOmnidirectional,
  move,
  pencil,
  plus,
  popout,
  refresh,
  trash,
  warning,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <EuiProvider colorMode="light">
    <App />
  </EuiProvider>
);
