/* eslint-disable @typescript-eslint/no-empty-object-type */
import '@emotion/react';
import type { UseEuiTheme } from '@elastic/eui';

declare module '@emotion/react' {
  export interface Theme extends UseEuiTheme {}
}
