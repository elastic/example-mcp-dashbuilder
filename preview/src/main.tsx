import React from 'react';
import ReactDOM from 'react-dom/client';
import { EuiProvider } from '@elastic/eui';
import { App } from './App';

import '@elastic/charts/dist/theme_light.css';

// Pre-cache the icons that kbn-grid-layout uses so EUI doesn't try dynamic imports
import { appendIconComponentCache } from '@elastic/eui/es/components/icon/icon';
import { icon as arrowDown } from '@elastic/eui/es/components/icon/assets/arrow_down';
import { icon as arrowRight } from '@elastic/eui/es/components/icon/assets/arrow_right';
import { icon as cross } from '@elastic/eui/es/components/icon/assets/cross';
import { icon as grabOmnidirectional } from '@elastic/eui/es/components/icon/assets/grabOmnidirectional';
import { icon as grab } from '@elastic/eui/es/components/icon/assets/grab';
import { icon as plus } from '@elastic/eui/es/components/icon/assets/plus';
import { icon as trash } from '@elastic/eui/es/components/icon/assets/trash';
import { icon as pencil } from '@elastic/eui/es/components/icon/assets/pencil';
import { icon as warning } from '@elastic/eui/es/components/icon/assets/warning';
import { icon as move } from '@elastic/eui/es/components/icon/assets/move';

appendIconComponentCache({
  arrowDown,
  arrowRight,
  cross,
  grabOmnidirectional,
  grab,
  plus,
  trash,
  pencil,
  warning,
  move,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <EuiProvider colorMode="light">
    <App />
  </EuiProvider>,
);
