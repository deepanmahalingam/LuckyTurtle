export const CONFIG = {
  DATA_URL: 'https://johannesfriedrich.github.io/LottoNumberArchive/Lottonumbers_complete.json',
  NUMBERS_MIN: 1,
  NUMBERS_MAX: 49,
  DRAW_SIZE: 6,
  CACHE_KEY: 'lucky-turtle-data',
  CACHE_VERSION: 'v2',
  CACHE_EXPIRY_MS: 24 * 60 * 60 * 1000,
  ALGORITHMS: ['frequency', 'neural', 'pattern', 'gap', 'bayesian'],
  ALGORITHM_NAMES: {
    frequency: 'Frequency Analysis',
    neural: 'Neural Network',
    pattern: 'Pattern Analysis',
    gap: 'Gap Analysis',
    bayesian: 'Bayesian Model'
  },
  ALGORITHM_WEIGHTS: {
    frequency: 0.20,
    neural: 0.25,
    pattern: 0.20,
    gap: 0.20,
    bayesian: 0.15
  }
};
