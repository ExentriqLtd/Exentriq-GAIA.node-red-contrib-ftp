/**
 * Copyright 2015 Atsushi Kojo.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
  'use strict';
  var ftp = require('ftp');
  var fs = require('fs');
  var toString = require('stream-to-string');

  function FtpNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var credentials = RED.nodes.getCredentials(n.id);
    this.options = {
      'host': n.host || 'localhost',
      'port': n.port || 21,
      'secure': n.secure || false,
      'secureOptions': n.secureOptions,
      'user': n.user || 'anonymous',
      'password': credentials.password || 'anonymous@',
      'connTimeout': n.connTimeout || 10000,
      'pasvTimeout': n.pasvTimeout || 10000,
      'keepalive': n.keepalive || 10000
    };
  }

  RED.nodes.registerType('ftp', FtpNode, {
    credentials: {
      password: { type: 'password' }
    }
  });

  function FtpInNode(n) {
    RED.nodes.createNode(this, n);
    this.ftp = n.ftp;
    this.operation = n.operation;
    this.filename = n.filename;
    this.localFilename = n.localFilename;
    this.ftpConfig = RED.nodes.getNode(this.ftp);

    if (this.ftpConfig) {

      var node = this;
      node.on('input', function (msg) {
	    var conn = new ftp();
	    var payload = msg.payload;
      var filename = node.filename || msg.filename || '';
      var localFilename = node.localFilename || msg.localFilename;
	    var path = msg.path;
      this.sendMsg = function (err, result) {
          if (err) {
            node.error(err.toString());
            node.status({ fill: 'red', shape: 'ring', text: 'failed' });
          }
          node.status({});
          var send_immediate = true;
          if (node.operation == 'get') {
            if(localFilename){
              result.once('close', function() { conn.end(); });
              result.pipe(fs.createWriteStream(localFilename));
              msg.payload = 'Get operation successful. ' + localFilename;
            }
            else{
              send_immediate = false;
              toString(result, function (err, text) {
                msg.payload=text;
                msg.filename = filename;
                conn.end();
                node.send(msg);
              })
            
            }
            
          } else if (node.operation == 'put') {
            conn.end();
            msg.payload = 'Put operation successful.';
          } else {
            conn.end();
            msg.payload = result;
          }
          if(send_immediate){
            msg.filename = filename;
            msg.localFilename = localFilename;
            node.send(msg);
          }
        };
        conn.on('ready', function () {
          switch (node.operation) {
            case 'list':
              if(path){
                conn.list(path, node.sendMsg);
              }
              else{
                conn.list(node.sendMsg);
              }
              break;
              case 'get':
                conn.get(filename, node.sendMsg);
              break;
            case 'put':
              if(!localFilename){
                var buf = Buffer.from(payload, 'utf8');
                conn.put(buf, filename, node.sendMsg);
              }
              else{
                  conn.put(localFilename, filename, node.sendMsg);
              }
              break;
            case 'delete':
              conn.delete(filename, node.sendMsg);
              break;
          }
        });
        conn.connect(node.ftpConfig.options);
      });
    } else {
      this.error('missing ftp configuration');
    }
  }
  RED.nodes.registerType('ftp in', FtpInNode);
}