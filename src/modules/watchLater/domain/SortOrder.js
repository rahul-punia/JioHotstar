'use strict';

const ASC = 'asc';
const DESC = 'desc';

/**
 * Ordering of a watch later list by `addedAt`. Ties (same millisecond) are broken by
 * insertion sequence so pages are stable.
 */
const SortOrder = Object.freeze({
  ASC,
  DESC,

  values() {
    return [ASC, DESC];
  },

  isValid(order) {
    return order === ASC || order === DESC;
  },

  /** 1 / -1, as used by MongoDB sort specs. */
  toDirection(order) {
    return order === ASC ? 1 : -1;
  },
});

module.exports = { SortOrder };
