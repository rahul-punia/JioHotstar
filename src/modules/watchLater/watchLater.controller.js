'use strict';

/** Translates HTTP requests into service calls; holds no business logic. */
class WatchLaterController {
  constructor({ service }) {
    this.service = service;
  }

  add = async (req, res) => {
    const item = await this.service.addContent(req.user.id, req.validated.body.contentId);
    res.status(201).json(item);
  };

  remove = async (req, res) => {
    await this.service.removeContent(req.user.id, req.validated.params.contentId);
    res.status(204).end();
  };

  list = async (req, res) => {
    const result = await this.service.listContent(req.user.id, req.validated.query);
    res.status(200).json(result);
  };
}

module.exports = { WatchLaterController };
