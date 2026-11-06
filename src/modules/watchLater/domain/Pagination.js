'use strict';

const { ValidationError } = require('../../../common/errors');

/**
 * Immutable page request (1-based `pageNo`). Translates to offset/limit for storage and
 * builds the pagination metadata returned to clients.
 */
class Pagination {
  constructor({ pageNo, pageSize, maxPageSize = Infinity }) {
    if (!Number.isInteger(pageNo) || pageNo < 1) {
      throw new ValidationError('pageNo must be a positive integer');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
      throw new ValidationError(`pageSize must be an integer between 1 and ${maxPageSize}`);
    }
    this.pageNo = pageNo;
    this.pageSize = pageSize;
    Object.freeze(this);
  }

  get offset() {
    return (this.pageNo - 1) * this.pageSize;
  }

  get limit() {
    return this.pageSize;
  }

  buildMeta(totalItems) {
    const totalPages = Math.ceil(totalItems / this.pageSize);
    return {
      pageNo: this.pageNo,
      pageSize: this.pageSize,
      totalItems,
      totalPages,
      hasNext: this.pageNo < totalPages,
    };
  }
}

module.exports = { Pagination };
