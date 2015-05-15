/**
 * Filesystem cache
 *
 * Given a file and a transform function, cache the result into files
 * or retrieve the previously cached files if the given file is already known.
 *
 * @see https://github.com/babel/babel-loader/issues/34
 * @see https://github.com/babel/babel-loader/pull/41
 */
var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var path = require('path');
var zlib = require('zlib');

/**
 * read
 *
 * Read the contents from the compressed file.
 *
 * @async
 * @params {String} filename
 * @params {Function} callback
 */
var read = function(filename, callback) {
  fs.readFile(filename, function(err, data) {
    if (err) { return callback(err); }

    zlib.gunzip(data, function(err, content) {
      var result = {};

      if (err) { return callback(err); }

      try {
        result = JSON.parse(content);
      } catch (e) {
        return callback(e);
      }

      return callback(null, content);
    });
  });
};


/**
 * write
 *
 * Write contents into a compressed file.
 *
 * @async
 * @params {String} filename
 * @params {String} result
 * @params {Function} callback
 */
var write = function(filename, result, callback) {
  var content = JSON.stringify(result);

  zlib.gzip(content, function(err, data) {
    if (err) { return callback(err); }

    fs.writeFile(filename, data, callback);
  });
};


/**
 * Build the filename for the cached file
 *
 * @params {String} source  File source code
 * @params {Object} options Options used
 *
 * @return {String}
 */
var filename = function(source, identifier, options) {
  var hash = crypto.createHash('SHA1');
  var contents = JSON.stringify({
      source: source,
      options: options,
      identifier: identifier,
    });

  hash.end(contents);

  return hash.read().toString('hex') + '.json.gzip';
};

/**
 * cache
 *
 * @async
 * @param  {Object}   params
 * @param  {String}   params.directory  Directory where cached files will be stored
 * @param  {String}   params.identifier Unique identifier to help with cache busting
 * @param  {String}   params.source   Original contents of the file to be cached
 * @param  {Object}   params.options  Options to be given to the transform function
 * @param  {Function} params.transform  Function that will transform the original
 *                    file and whose result will be cached
 *
 * @param  {Function<err, result>} callback
 *
 * @example
 *
 *   cache({
 *     directory: '.tmp/cache',
 *     identifier: 'babel-loader-cachefile',
 *     source: *source code from file*,
 *     options: {
 *       experimental: true,
 *       runtime: true
 *     },
 *     transform: function(source, options) {
 *       var content = *do what you need with the source*
 *       return content;
 *     }
 *   }, function(err, result) {
 *
 *   });
 */
var cache = module.exports = function(params, callback) {
  // Spread params into named variables
  // Forgive user whenever possible
  var source = params.source;
  var options = params.options || {};
  var transform = params.transform;
  var identifier = params.identifier;
  var directory = (typeof params.directory === 'string') ?
        params.directory :
        os.tmpdir();
  var file = path.join(directory, filename(source, identifier, options));

  read(file, function(err, content) {
    var result = {};

    if (!err) { return callback(null, content); }

    result = transform(source, options);

    return write(file, result, function(err) {
      callback(err, result);
    });
  });
};