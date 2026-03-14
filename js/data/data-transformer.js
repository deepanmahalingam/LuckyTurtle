import { CONFIG } from '../config.js';

export class DataTransformer {
  /**
   * Parse raw API response into normalized draw objects.
   * The LottoNumberArchive data has various formats - this handles them.
   */
  static parseDraws(rawData) {
    let draws = [];

    if (Array.isArray(rawData)) {
      draws = rawData.map((d, i) => DataTransformer.parseSingleDraw(d, i)).filter(Boolean);
    } else if (rawData && typeof rawData === 'object') {
      // Sometimes data comes as { draws: [...] } or similar
      const arr = rawData.draws || rawData.data || Object.values(rawData);
      if (Array.isArray(arr)) {
        draws = arr.map((d, i) => DataTransformer.parseSingleDraw(d, i)).filter(Boolean);
      }
    }

    // Sort by date ascending
    draws.sort((a, b) => a.date - b.date);

    // Assign sequential IDs
    draws.forEach((d, i) => d.id = i + 1);

    return draws;
  }

  static parseSingleDraw(d, index) {
    if (!d) return null;

    let numbers = [];
    let date = null;
    let superzahl = null;

    // Extract numbers - handle various field names
    if (d.Lottozahl && Array.isArray(d.Lottozahl)) {
      numbers = d.Lottozahl.map(Number).filter(n => n >= 1 && n <= 49);
    } else if (d.numbers && Array.isArray(d.numbers)) {
      numbers = d.numbers.map(Number).filter(n => n >= 1 && n <= 49);
    } else if (d.Lottozahlen && Array.isArray(d.Lottozahlen)) {
      numbers = d.Lottozahlen.map(Number).filter(n => n >= 1 && n <= 49);
    } else {
      // Try to find number fields like Zahl1, Zahl2, etc. or n1, n2, etc.
      const numFields = [];
      for (let i = 1; i <= 6; i++) {
        const val = d[`Zahl${i}`] || d[`zahl${i}`] || d[`n${i}`] || d[`number${i}`];
        if (val) numFields.push(Number(val));
      }
      if (numFields.length === 6) numbers = numFields.filter(n => n >= 1 && n <= 49);
    }

    // Extract date
    if (d.date || d.Date || d.Datum || d.datum) {
      const dateStr = d.date || d.Date || d.Datum || d.datum;
      date = DataTransformer.parseDate(dateStr);
    }

    // Extract Superzahl
    if (d.Superzahl !== undefined) superzahl = Number(d.Superzahl);
    else if (d.superzahl !== undefined) superzahl = Number(d.superzahl);

    if (numbers.length < 6 || !date || isNaN(date.getTime())) return null;

    return {
      id: index,
      date,
      numbers: numbers.slice(0, 6).sort((a, b) => a - b),
      superzahl
    };
  }

  static parseDate(dateStr) {
    if (dateStr instanceof Date) return dateStr;
    const str = String(dateStr).trim();

    // DD.MM.YYYY
    const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      return new Date(parseInt(dotMatch[3]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[1]));
    }

    // YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }

    // Fallback
    return new Date(str);
  }

  /**
   * Count frequency of each number (1-49)
   */
  static buildFrequencyTable(draws, lastN = null) {
    const subset = lastN ? draws.slice(-lastN) : draws;
    const freq = new Map();
    for (let i = 1; i <= CONFIG.NUMBERS_MAX; i++) freq.set(i, 0);

    for (const draw of subset) {
      for (const num of draw.numbers) {
        freq.set(num, (freq.get(num) || 0) + 1);
      }
    }
    return freq;
  }

  /**
   * Builds gap table: draws since each number was last drawn
   */
  static buildGapTable(draws) {
    const gaps = new Map();
    const totalDraws = draws.length;

    for (let n = 1; n <= CONFIG.NUMBERS_MAX; n++) {
      let lastSeen = -1;
      for (let i = totalDraws - 1; i >= 0; i--) {
        if (draws[i].numbers.includes(n)) {
          lastSeen = i;
          break;
        }
      }
      gaps.set(n, lastSeen === -1 ? totalDraws : totalDraws - 1 - lastSeen);
    }
    return gaps;
  }

  /**
   * Build a Set of all historical combinations for uniqueness checking.
   * Key format: sorted numbers joined by comma.
   */
  static buildHistoricalSet(draws) {
    return new Set(draws.map(d => d.numbers.join(',')));
  }

  /**
   * Get the expected frequency (each number has 6/49 chance per draw)
   */
  static expectedFrequency(totalDraws) {
    return (totalDraws * CONFIG.DRAW_SIZE) / CONFIG.NUMBERS_MAX;
  }

  /**
   * Calculate co-occurrence matrix for pairs of numbers
   */
  static buildPairMatrix(draws) {
    const matrix = {};
    for (let i = 1; i <= CONFIG.NUMBERS_MAX; i++) {
      matrix[i] = {};
      for (let j = i + 1; j <= CONFIG.NUMBERS_MAX; j++) {
        matrix[i][j] = 0;
      }
    }
    for (const draw of draws) {
      const nums = draw.numbers;
      for (let a = 0; a < nums.length; a++) {
        for (let b = a + 1; b < nums.length; b++) {
          const lo = Math.min(nums[a], nums[b]);
          const hi = Math.max(nums[a], nums[b]);
          matrix[lo][hi]++;
        }
      }
    }
    return matrix;
  }
}
