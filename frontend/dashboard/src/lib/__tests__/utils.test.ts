import { formatDateTime, formatChartTime, formatTemperature, formatBooleanStatus, formatMode, cn } from '../utils';

describe('utils.ts', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });
  });

  describe('formatDateTime', () => {
    it('returns "Sin fecha" for null or undefined', () => {
      expect(formatDateTime(null)).toBe('Sin fecha');
      expect(formatDateTime(undefined)).toBe('Sin fecha');
    });

    it('returns "Sin fecha" for invalid dates', () => {
      expect(formatDateTime('invalid-date')).toBe('Sin fecha');
    });

    it('formats valid ISO dates correctly', () => {
      const isoDate = '2023-10-15T14:30:00Z';
      const result = formatDateTime(isoDate);
      expect(result).toMatch(/\d{2}/);
    });
  });

  describe('formatTemperature', () => {
    it('formats a number with 1 decimal place and °C', () => {
      expect(formatTemperature(25)).toBe('25.0 °C');
      expect(formatTemperature(25.123)).toBe('25.1 °C');
    });

    it('returns "--.- °C" for null, undefined, or NaN', () => {
      expect(formatTemperature(null)).toBe('--.- °C');
      expect(formatTemperature(undefined)).toBe('--.- °C');
      expect(formatTemperature(NaN)).toBe('--.- °C');
    });
  });

  describe('formatBooleanStatus', () => {
    it('returns "Detectado" for true', () => {
      expect(formatBooleanStatus(true)).toBe('Detectado');
    });

    it('returns "Sin actividad" for false', () => {
      expect(formatBooleanStatus(false)).toBe('Sin actividad');
    });
  });

  describe('formatMode', () => {
    it('translates known modes', () => {
      expect(formatMode('Normal')).toBe('Normal');
      expect(formatMode('Meeting')).toBe('Reunion');
      expect(formatMode('Energy Saving')).toBe('Ahorro de energia');
    });

    it('returns the input if mode is unknown', () => {
      expect(formatMode('UnknownMode')).toBe('UnknownMode');
    });

    it('returns "Sin modo" if input is undefined or null', () => {
      expect(formatMode()).toBe('Sin modo');
      expect(formatMode(undefined)).toBe('Sin modo');
    });
  });
});
