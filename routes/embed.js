'use strict';

/**
 * Module dependencies.
 */

var CP_api = require('../modules/CP_api');

/**
 * Configuration dependencies.
 */

var config = require('../config/production/config');
Object.keys(config).length === 0 &&
  (config = require('../config/production/config.backup'));
var config_md5 = require('md5')(JSON.stringify(config));

var modules = require('../config/production/modules');
Object.keys(modules).length === 0 &&
  (modules = require('../config/production/modules.backup'));
var modules_md5 = require('md5')(JSON.stringify(modules));

setInterval(function() {
  if (
    config_md5 &&
    process.env['CP_CONFIG_MD5'] &&
    config_md5 !== process.env['CP_CONFIG_MD5']
  ) {
    config = require('../config/production/config');
    Object.keys(config).length === 0 &&
      (config = require('../config/production/config.backup'));
    config_md5 = process.env['CP_CONFIG_MD5'];
  }
  if (
    modules_md5 &&
    process.env['CP_MODULES_MD5'] &&
    modules_md5 !== process.env['CP_MODULES_MD5']
  ) {
    modules = require('../config/production/modules');
    Object.keys(modules).length === 0 &&
      (modules = require('../config/production/modules.backup'));
    modules_md5 = process.env['CP_MODULES_MD5'];
  }
}, 3333);

/**
 * Node dependencies.
 */

var express = require('express');
var md5 = require('md5');
var router = express.Router();
var LRU = require('lru-cache');
var embeds = new LRU({ maxAge: 3600000, max: 1000 });

/**
 * Iframe code.
 */

var err_top =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error embed</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.gstatic.com"><link href="https://fonts.googleapis.com/css2?family=Play&display=swap" rel="stylesheet"> <style>*{margin:30px 0;padding:0;border:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font-family:"Play",sans-serif;}.container{text-align:center;position:absolute;top:50%;left:50%;-moz-transform:translateX(-50%) translateY(-50%);-webkit-transform:translateX(-50%) translateY(-50%);transform:translateX(-50%) translateY(-50%);width:300px}</style></head><body><div class="container">';
var err_bottom = '</div></body></html>';

router.get('/:id/:hash?', function(req, res) {
  var err = '';
  var ip = getIp(req);
  var id =
    req.params.id && ('' + req.params.id).replace(/[^0-9]/g, '')
      ? ('' + req.params.id).replace(/[^0-9]/g, '')
      : '';
  var hash =
    req.params.hash && ('' + req.params.hash).replace(/[^a-z0-9]/gi, '')
      ? ('' + req.params.hash).replace(/[^a-z0-9]/gi, '')
      : '';
  var api_hash = md5(id + '.' + ip + '.' + config.urls.admin);
  if (!id) {
    err = 'ID is incorrect.';
  }
  if (typeof req.query.api !== 'undefined' && api_hash !== hash) {
    err = 'HASH is incorrect.';
  }
  if (err) {
    return res.status(404).send(err_top + err + err_bottom);
  }
  if (typeof req.query.api === 'undefined') {
    if (hash) {
      CP_api.movie({ id: id }, null, function(err, result) {
        if (err) {
          return res.status(404).send(err_top + err + err_bottom);
        }
        if (
          !result ||
          !result.result ||
          !result.result.players ||
          !result.result.players.length
        ) {
          return res.status(404).send(err_top + 'Not player!' + err_bottom);
        }
        var name = '';
        var src = '';
        result.result.players.forEach(function(p) {
          var id = md5(
            p.src + '.' + ip + '.' + new Date().toJSON().substr(0, 10)
          );
          if (id && hash && id === hash && p.name && p.src) {
            name = p.name;
            src = p.src;
          }
        });
        if (name && src) {
          return res.send(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' +
              name +
              '</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden}</style></head><body><iframe src="' +
              src +
              '" frameborder="0" allowfullscreen="1" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowtransparency="true" scrolling="no" style="margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden;background:#000"></iframe></body></html>'
          );
        } else {
          return res.status(404).send(err_top + 'Not player!' + err_bottom);
        }
      });
    } else {
      return res.send(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' +
          id +
          '</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;border:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="cinemaplayer" data-cinemaplayer-api="/embed/' +
          id +
          '/' +
          api_hash +
          '?api"></div><script src="https://CinemaPlayer.github.io/cinemaplayer.js"></script></body></html>'
      );
    }
  } else {
    CP_api.movie({ id: id }, ip, function(err, result) {
      if (err) {
        return res.status(404).json({ status: 'error', message: err });
      }
      if (
        result &&
        result.result &&
        result.result.players &&
        result.result.players.length
      ) {
        return res.json({ 'simple-api': result.result.players });
      } else {
        return res
          .status(404)
          .json({ status: 'error', message: 'Not players!' });
      }
    });
  }
});

function getIp(req) {
  var ips = req.ips || [];
  var ip = '';
  if (req.header('x-forwarded-for')) {
    req
      .header('x-forwarded-for')
      .split(',')
      .forEach(function(one_ip) {
        if (ips.indexOf(one_ip.trim()) === -1) {
          ips.push(one_ip.trim());
        }
      });
  }
  if (req.header('x-real-ip')) {
    req
      .header('x-real-ip')
      .split(',')
      .forEach(function(one_ip) {
        if (ips.indexOf(one_ip.trim()) === -1) {
          ips.push(one_ip.trim());
        }
      });
  }
  if (req.connection.remoteAddress) {
    req.connection.remoteAddress.split(',').forEach(function(one_ip) {
      if (ips.indexOf(one_ip.trim()) === -1) {
        ips.push(one_ip.trim());
      }
    });
  }
  ips.forEach(function(one_ip) {
    if (ip) return;
    one_ip = one_ip.replace('::ffff:', '');
    if (
      one_ip !== '127.0.0.1' &&
      /^([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\.([01]?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])$/.test(
        one_ip
      )
    ) {
      ip = one_ip;
    }
  });
  return ip;
}

module.exports = router;
