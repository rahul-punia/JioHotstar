'use strict';

const express = require('express');
const { validate } = require('../../common/middleware/validate');
const { asyncHandler } = require('../../common/middleware/asyncHandler');

/**
 * POST   /           { contentId }                 → 201 { contentId, addedAt }
 * DELETE /:contentId                               → 204
 * GET    /?pageNo=&pageSize=&order=asc|desc        → 200 { items, pagination }
 */
function createWatchLaterRouter({ controller, authenticate, schemas }) {
  const router = express.Router();
  router.use(authenticate);
  router.post('/', validate({ body: schemas.add }), asyncHandler(controller.add));
  router.delete('/:contentId', validate({ params: schemas.remove }), asyncHandler(controller.remove));
  router.get('/', validate({ query: schemas.list }), asyncHandler(controller.list));
  return router;
}

module.exports = { createWatchLaterRouter };
