import { Promise } from 'meteor/promise';
import { devlog } from './dev';
import { isAssetChain } from './utils';
import { parseTransactionAddresses } from './parseTransactionAddresses';
import { electrumJSTxDecoder } from './txDecoder/txDecoder';

const CONNECTION_ERROR_OR_INCOMPLETE_DATA = 'connection error or incomplete data';

const electrumJSNetworks = require('./electrumNetworks.js');

export const listtransactions = (proxyServer, electrumServer, address, network, full, verify) => {
  return new Promise((resolve, reject) => {
    // get current height
    HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/getcurrentblock`, {
      params: {
        port: electrumServer.port,
        ip: electrumServer.ip,
      },
    }, (error, result) => {
      result = JSON.parse(result.content);

      if (result.msg === 'error') {
        resolve('error');
      } else {
        const currentHeight = result.result;

        devlog('currentHeight =>');
        devlog(currentHeight);

        HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/listtransactions`, {
          params: {
            port: electrumServer.port,
            ip: electrumServer.ip,
            address,
            raw: true,
          },
        }, (error, result) => {
          result = JSON.parse(result.content);

          if (result.msg !== 'error') {
            let _transactions = [];

            // parse listtransactions
            const json = result.result;

            if (json &&
                json.length) {
              let _rawtx = [];

              Promise.all(json.map((transaction, index) => {
                return new Promise((resolve, reject) => {
                  HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/getblockinfo`, {
                    params: {
                      port: electrumServer.port,
                      ip: electrumServer.ip,
                      address,
                      height: transaction.height,
                    },
                  }, (error, result) => {
                    devlog('getblock =>');
                    devlog(result);

                    result = JSON.parse(result.content);

                    if (result.msg !== 'error') {
                      const blockInfo = result.result;

                      devlog('electrum gettransaction ==>');
                      devlog((index + ' | ' + (transaction.raw.length - 1)));
                      devlog(transaction.raw);

                      // decode tx
                      const _network = electrumJSNetworks[isAssetChain(network) ? 'komodo' : network];
                      const decodedTx = electrumJSTxDecoder(transaction.raw, network, _network);

                      let txInputs = [];

                      devlog('decodedtx =>');
                      devlog(decodedTx.outputs);

                      if (decodedTx &&
                          decodedTx.inputs) {
                        Promise.all(decodedTx.inputs.map((_decodedInput, index) => {
                          return new Promise((_resolve, _reject) => {
                            if (_decodedInput.txid !== '0000000000000000000000000000000000000000000000000000000000000000') {
                              HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/gettransaction`, {
                                params: {
                                  port: electrumServer.port,
                                  ip: electrumServer.ip,
                                  address,
                                  txid: _decodedInput.txid,
                                },
                              }, (error, result) => {
                                devlog('gettransaction =>');
                                devlog(result);

                                result = JSON.parse(result.content);

                                if (result.msg !== 'error') {
                                  const decodedVinVout = electrumJSTxDecoder(result.result, network, _network);

                                  devlog('electrum raw input tx ==>');

                                  if (decodedVinVout) {
                                    devlog(decodedVinVout.outputs[_decodedInput.n], true);
                                    txInputs.push(decodedVinVout.outputs[_decodedInput.n]);
                                    _resolve(true);
                                  } else {
                                    _resolve(true);
                                  }
                                }
                              });
                            } else {
                              _resolve(true);
                            }
                          });
                        }))
                        .then(promiseResult => {
                          const _parsedTx = {
                            network: decodedTx.network,
                            format: decodedTx.format,
                            inputs: txInputs,
                            outputs: decodedTx.outputs,
                            height: transaction.height,
                            timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                            confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                          };

                          const formattedTx = parseTransactionAddresses(_parsedTx, address, 'komodo');

                          if (formattedTx.type) {
                            formattedTx.height = transaction.height;
                            formattedTx.blocktime = blockInfo.timestamp;
                            formattedTx.timereceived = blockInfo.timereceived;
                            formattedTx.hex = transaction.raw;
                            formattedTx.inputs = decodedTx.inputs;
                            formattedTx.outputs = decodedTx.outputs;
                            formattedTx.locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx);
                          } else {
                            formattedTx[0].height = transaction.height;
                            formattedTx[0].blocktime = blockInfo.timestamp;
                            formattedTx[0].timereceived = blockInfo.timereceived;
                            formattedTx[0].hex = transaction.raw;
                            formattedTx[0].inputs = decodedTx.inputs;
                            formattedTx[0].outputs = decodedTx.outputs;
                            formattedTx[0].locktime = decodedTx.format.locktime;
                            formattedTx[1].height = transaction.height;
                            formattedTx[1].blocktime = blockInfo.timestamp;
                            formattedTx[1].timereceived = blockInfo.timereceived;
                            formattedTx[1].hex = transaction.raw;
                            formattedTx[1].inputs = decodedTx.inputs;
                            formattedTx[1].outputs = decodedTx.outputs;
                            formattedTx[1].locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx[0]);
                            _rawtx.push(formattedTx[1]);
                          }
                          resolve(true);
                        });
                      } else {
                        const _parsedTx = {
                          network: decodedTx.network,
                          format: 'cant parse',
                          inputs: 'cant parse',
                          outputs: 'cant parse',
                          height: transaction.height,
                          timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                          confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                        };

                        const formattedTx = parseTransactionAddresses(_parsedTx, address, 'komodo');
                        _rawtx.push(formattedTx);
                        resolve(true);
                      }
                    } else {
                      const _parsedTx = {
                        network: 'cant parse',
                        format: 'cant parse',
                        inputs: 'cant parse',
                        outputs: 'cant parse',
                        height: transaction.height,
                        timestamp: 'cant get block info',
                        confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                      };
                      const formattedTx = parseTransactionAddresses(_parsedTx, address, 'komodo');
                      _rawtx.push(formattedTx);
                      resolve(true);
                    }
                  });
                });
              }))
              .then(promiseResult => {
                resolve(_rawtx);
              });
            } else {
              // empty history
              resolve([]);
            }
          } else {
            resolve('error');
          }

          devlog(result);
        });
      }
    });
  });
}