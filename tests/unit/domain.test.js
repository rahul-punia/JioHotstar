'use strict';

const { Pagination } = require('../../src/modules/watchLater/domain/Pagination');
const { SortOrder } = require('../../src/modules/watchLater/domain/SortOrder');
const { ValidationError } = require('../../src/common/errors');

describe('Pagination', () => {
  test('computes offset and limit from a 1-based page number', () => {
    const page = new Pagination({ pageNo: 3, pageSize: 20 });
    expect(page.offset).toBe(40);
    expect(page.limit).toBe(20);
  });

  test('is immutable', () => {
    const page = new Pagination({ pageNo: 1, pageSize: 10 });
    expect(Object.isFrozen(page)).toBe(true);
  });

  test.each([0, -1, 1.5, '1', undefined])('rejects pageNo %p', (pageNo) => {
    expect(() => new Pagination({ pageNo, pageSize: 10 })).toThrow(ValidationError);
  });

  test.each([0, 101, 2.5, null])('rejects pageSize %p when max is 100', (pageSize) => {
    expect(() => new Pagination({ pageNo: 1, pageSize, maxPageSize: 100 })).toThrow(ValidationError);
  });

  test.each([
    [1, 10, 25, { totalPages: 3, hasNext: true }],
    [3, 10, 25, { totalPages: 3, hasNext: false }],
    [1, 10, 10, { totalPages: 1, hasNext: false }],
    [1, 10, 0, { totalPages: 0, hasNext: false }],
    [5, 10, 25, { totalPages: 3, hasNext: false }],
  ])('page %i size %i of %i items', (pageNo, pageSize, totalItems, expected) => {
    expect(new Pagination({ pageNo, pageSize }).buildMeta(totalItems)).toEqual({
      pageNo,
      pageSize,
      totalItems,
      ...expected,
    });
  });
});

describe('SortOrder', () => {
  test('lists the supported values', () => {
    expect(SortOrder.values()).toEqual(['asc', 'desc']);
  });

  test.each([
    ['asc', true],
    ['desc', true],
    ['ASC', false],
    ['random', false],
    [undefined, false],
  ])('isValid(%p) is %p', (value, expected) => {
    expect(SortOrder.isValid(value)).toBe(expected);
  });

  test('maps to sort directions', () => {
    expect(SortOrder.toDirection('asc')).toBe(1);
    expect(SortOrder.toDirection('desc')).toBe(-1);
  });
});
