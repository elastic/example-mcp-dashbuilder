import { getESClient } from './es-client.js';

/**
 * Pick the time field from a list of date fields.
 * Priority: @timestamp > timestamp > first date field.
 */
export function pickTimeField(dateFields: string[]): string | undefined {
  if (dateFields.includes('@timestamp')) return '@timestamp';
  if (dateFields.includes('timestamp')) return 'timestamp';
  return dateFields[0];
}

/**
 * Detect the time field for an index via field_caps.
 * Returns undefined if the index has no date fields.
 */
export async function detectTimeField(index: string): Promise<string | undefined> {
  try {
    const client = getESClient();
    const caps = await client.fieldCaps({
      index,
      fields: '*',
      types: ['date', 'date_nanos'],
    });
    return pickTimeField(Object.keys(caps.fields || {}));
  } catch {
    return undefined;
  }
}
