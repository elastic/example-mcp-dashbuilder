import { Parser } from '@elastic/esql';
import type { ESQLSource } from '@elastic/esql/types';

/** Extract the index pattern from an ES|QL query using the AST parser. */
export function parseIndexPattern(query: string): string | undefined {
  try {
    const { root } = Parser.parse(query);
    const sourceCommand = root.commands.find(
      ({ name }) => name.toUpperCase() === 'FROM' || name.toUpperCase() === 'TS'
    );
    if (!sourceCommand) return undefined;

    const sources = (sourceCommand.args as ESQLSource[])
      .filter((arg) => arg.sourceType === 'index')
      .map((index) => index.name);

    return sources.join(',') || undefined;
  } catch {
    return undefined;
  }
}
