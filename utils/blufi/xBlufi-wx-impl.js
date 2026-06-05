

let tempTimer = 0;
let client = null;
let util = null
let mDeviceEvent = null
let crypto = null
let md5 = null
let aesjs = null
const timeOut = 20; //超时时间
var timeId = "";
let sequenceControl = 0;
let sequenceNumber = -1;

let self = {
  data: {
    deviceId: null,
    isConnected: false,
    failure: false,
    value: 0,
    desc: "请耐心等待...",
    isChecksum: true,
    isEncrypt: true,
    flagEnd: false,
    defaultData: 1,
    ssidType: 2,
    passwordType: 3,
    meshIdType: 3,
    deviceId: "",
    ssid: "",
    uuid: "",
    serviceId: "",
    password: "",
    meshId: "",
    processList: [],
    result: [],
    service_uuid: "0000FFFF-0000-1000-8000-00805F9B34FB",
    characteristic_write_uuid: "0000FF01-0000-1000-8000-00805F9B34FB",
    characteristic_read_uuid: "0000FF02-0000-1000-8000-00805F9B34FB",
    customData: null,
    md5Key: 0,
  }
}

function buf2hex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function bleUuidMatches(uuid, target) {
  const n = (uuid || '').toUpperCase().replace(/-/g, '');
  const t = (target || '').toUpperCase().replace(/-/g, '');
  if (!n || !t) return false;
  if (n === t) return true;
  const nShort = n.length >= 8 ? n.substring(4, 8) : n;
  const tShort = t.length >= 8 ? t.substring(4, 8) : t;
  return n.includes(tShort) || t.includes(nShort);
}

let bleNotifyListenerRegistered = false;

function emitConnectRouterResult(success, progress, ssid) {
  mDeviceEvent.notifyDeviceMsgEvent({
    'type': mDeviceEvent.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT,
    'result': success,
    'data': {
      'progress': progress,
      'ssid': ssid || ''
    }
  });
}

function handleGoodSleepStatusFrame(bytes) {
  const statusCode = bytes[bytes.length - 1];
  console.log('[GoodSleep] 状态码 0x' + statusCode.toString(16));
  if (statusCode === 0x04) {
    emitConnectRouterResult(true, 100, '');
    return true;
  }
  if (statusCode === 0x03) {
    emitConnectRouterResult(false, 0, '');
    return true;
  }
  return false;
}

function handleBleCharacteristicNotify(res) {
  if (!self || !self.data) {
    return;
  }

  const rawBytes = new Uint8Array(res.value);
  const rawHex = Array.from(rawBytes).map((b) => ('0' + b.toString(16)).slice(-2)).join('');
  console.log('[BluFi notify raw hex]', rawHex);

  if (
    rawBytes.length >= 5
    && rawBytes[0] === 0x55
    && rawBytes[1] === 0xAA
    && rawBytes[2] === 0x55
    && rawBytes[3] === 0xAA
  ) {
    handleGoodSleepStatusFrame(rawBytes);
    return;
  }

  let list2 = util.ab2hex(res.value);
  let result = self.data.result;
  if (list2.length < 4) {
    return;
  }
  var val = parseInt(list2[0], 16),
    type = val & 3,
    subType = val >> 2;
  var dataLength = parseInt(list2[3], 16);
  if (dataLength == 0) {
    return;
  }
  var fragNum = util.hexToBinArray(list2[1]);
  list2 = isEncrypt(fragNum, list2, self.data.md5Key);
  result = result.concat(list2);
  self.data.result = result;
  if (self.data.flagEnd) {
    self.data.flagEnd = false;
    if (type == 1) {
      let what = [];
      switch (subType) {
        case 15:
          if (result.length == 3) {
            emitConnectRouterResult(false, 0, what.join(''));
          } else {
            for (var i = 0; i <= result.length; i++) {
              if (i > 12) what.push(String.fromCharCode(parseInt(result[i], 16)));
            }
            emitConnectRouterResult(true, 100, what.join(''));
          }
          break;
        case 18:
          {
            const statusCode = result.length > 0 ? parseInt(result[result.length - 1], 16) : -1;
            console.log('[GoodSleep] BluFi subType 18 status: 0x' + statusCode.toString(16));
            if (statusCode === 0x04) {
              emitConnectRouterResult(true, 100, '');
            } else if (statusCode === 0x03) {
              emitConnectRouterResult(false, 0, '');
            }
          }
          break;
        case 19:
          {
            let customData = [];
            for (var j = 0; j <= result.length; j++) {
              customData.push(String.fromCharCode(parseInt(result[j], 16)));
            }
            mDeviceEvent.notifyDeviceMsgEvent({
              'type': mDeviceEvent.XBLUFI_TYPE.TYPE_RECIEVE_CUSTON_DATA,
              'result': true,
              'data': customData.join('')
            });
          }
          break;
        case util.SUBTYPE_NEGOTIATION_NEG:
          if (!client) {
            console.log('[BluFi] 收到 security neg，当前未启用 DH 握手');
            break;
          }
          {
            var arr = util.hexByInt(result.join(""));
            var clientSecret = client.computeSecret(new Uint8Array(arr));
            var md5Key = md5.array(clientSecret);
            self.data.md5Key = md5Key;
            mDeviceEvent.notifyDeviceMsgEvent({
              'type': mDeviceEvent.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT,
              'result': true,
              'data': {
                deviceId: self.data.deviceId,
                serviceId: self.data.serviceId,
                characteristicId: self.data.uuid
              }
            });
          }
          break;
        default:
          console.log('[BluFi] notify subType:', subType, 'raw:', list2.join(''));
          break;
      }
      self.data.result = [];
    } else {
      console.log('[BluFi] notify type!=1, subType:', subType);
    }
  }
}

function notifyInitEsp32Success(deviceId, serviceId, writeCharId, notifyCharId) {
  self.data.isEncrypt = false;
  mDeviceEvent.notifyDeviceMsgEvent({
    'type': mDeviceEvent.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT,
    'result': true,
    'data': {
      deviceId,
      serviceId,
      characteristicId: writeCharId,
      notifyCharacteristicId: notifyCharId
    }
  });
}

function notifyInitEsp32Fail(res) {
  mDeviceEvent.notifyDeviceMsgEvent({
    'type': mDeviceEvent.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT,
    'result': false,
    'data': res
  });
}

function buf2string(buffer) {
  var arr = Array.prototype.map.call(new Uint8Array(buffer), x => x);
  var str = '';
  for (var i = 0; i < arr.length; i++) {
    str += String.fromCharCode(arr[i]);
  }
  return str;
}

function getSsids(str) {
  var list = [],
    strs = str.split(":");
  for (var i = 0; i < strs.length; i++) {
    list.push(parseInt(strs[i], 16));
  }
  return list;
}

function getCharCodeat(str) {
  var list = [];
  for (var i = 0; i < str.length; i++) {
    list.push(str.charCodeAt(i));
  }
  return list;
}


//判断返回的数据是否加密
function isEncrypt(fragNum, list, md5Key) {
  var checksum = [],
    checkData = [];
  if (fragNum[7] == "1") { //返回数据加密
    if (fragNum[6] == "1") {
      var len = list.length - 2;
      list = list.slice(0, len);
    }
    var iv = this.generateAESIV(parseInt(list[2], 16));
    if (fragNum[3] == "0") { //未分包
      list = list.slice(4);
      self.data.flagEnd = true
    } else { //分包
      list = list.slice(6);
    }
  } else { //返回数据未加密
    if (fragNum[6] == "1") {
      var len = list.length - 2;
      list = list.slice(0, len);
    }
    if (fragNum[3] == "0") { //未分包
      list = list.slice(4);
      self.data.flagEnd = true
    } else { //分包
      list = list.slice(6);
    }
  }
  return list;
}

function getSecret(deviceId, serviceId, characteristicId, client, kBytes, pBytes, gBytes, data) {

  var obj = [],
    frameControl = 0;
  sequenceControl = parseInt(sequenceControl) + 1;
  if (!util._isEmpty(data)) {
    obj = util.isSubcontractor(data, true, sequenceControl);
    frameControl = util.getFrameCTRLValue(false, true, util.DIRECTION_OUTPUT, false, obj.flag);
  } else {
    data = [];
    data.push(util.NEG_SET_SEC_ALL_DATA);
    var pLength = pBytes.length;
    var pLen1 = (pLength >> 8) & 0xff;
    var pLen2 = pLength & 0xff;
    data.push(pLen1);
    data.push(pLen2);
    data = data.concat(pBytes);
    var gLength = gBytes.length;
    var gLen1 = (gLength >> 8) & 0xff;
    var gLen2 = gLength & 0xff;
    data.push(gLen1);
    data.push(gLen2);
    data = data.concat(gBytes);
    var kLength = kBytes.length;
    var kLen1 = (kLength >> 8) & 0xff;
    var kLen2 = kLength & 0xff;
    data.push(kLen1);
    data.push(kLen2);
    data = data.concat(kBytes);
    obj = util.isSubcontractor(data, true, sequenceControl);
    frameControl = util.getFrameCTRLValue(false, true, util.DIRECTION_OUTPUT, false, obj.flag);
  }
  var value = util.writeData(util.PACKAGE_VALUE, util.SUBTYPE_NEG, frameControl, sequenceControl, obj.len, obj.lenData);
  var typedArray = new Uint8Array(value);
  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {
      if (obj.flag) {
        getSecret(deviceId, serviceId, characteristicId, client, kBytes, pBytes, gBytes, obj.laveData);
      }
    },
    fail: function(res) {}
  })
}

function writeDeviceRouterInfoStart(deviceId, serviceId, characteristicId, data) {
  var obj = {},
    frameControl = 0;
  sequenceControl = parseInt(sequenceControl) + 1;
  if (!util._isEmpty(data)) {
    obj = util.isSubcontractor(data, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  } else {
    obj = util.isSubcontractor([self.data.defaultData], self.data.isChecksum, sequenceControl, true);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  }
  console.log("self.data.md5Key=",self.data.md5Key)
  console.log("obj.lenData=",obj.lenData)
  var defaultData = util.encrypt(aesjs, self.data.md5Key, sequenceControl, obj.lenData, true);
  var value = util.writeData(util.PACKAGE_CONTROL_VALUE, util.SUBTYPE_WIFI_MODEl, frameControl, sequenceControl, obj.len, defaultData);
  var typedArray = new Uint8Array(value)
  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {
      if (obj.flag) {
        writeDeviceRouterInfoStart(deviceId, serviceId, characteristicId, obj.laveData);
      } else {
        writeRouterSsid(deviceId, serviceId, characteristicId, null);
      }
    },
    fail: function(res) {
    }
  })
}

function writeCutomsData(deviceId, serviceId, characteristicId, data) {
  var obj = {},
    frameControl = 0;
  sequenceControl = parseInt(sequenceControl) + 1;
  if (!util._isEmpty(data)) {
    obj = util.isSubcontractor(data, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  } else {
    var ssidData = getCharCodeat(self.data.customData);
    obj = util.isSubcontractor(ssidData, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  }
  var defaultData = util.encrypt(aesjs, self.data.md5Key, sequenceControl, obj.lenData, true);
  var value = util.writeData(util.PACKAGE_VALUE, util.SUBTYPE_CUSTOM_DATA, frameControl, sequenceControl, obj.len, defaultData);
  var typedArray = new Uint8Array(value)
  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {
      if (obj.flag) {
        writeCutomsData(deviceId, serviceId, characteristicId, obj.laveData);
      }
    },
    fail: function(res) {
      //console.log(257);
    }
  })
}




function writeRouterSsid(deviceId, serviceId, characteristicId, data) {
  var obj = {},
    frameControl = 0;
  sequenceControl = parseInt(sequenceControl) + 1;
  if (!util._isEmpty(data)) {
    obj = util.isSubcontractor(data, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  } else {
    var ssidData = getCharCodeat(self.data.ssid);
    obj = util.isSubcontractor(ssidData, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  }
  var defaultData = util.encrypt(aesjs, self.data.md5Key, sequenceControl, obj.lenData, true);
  var value = util.writeData(util.PACKAGE_VALUE, util.SUBTYPE_SET_SSID, frameControl, sequenceControl, obj.len, defaultData);
  var typedArray = new Uint8Array(value)
  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {
      if (obj.flag) {
        writeRouterSsid(deviceId, serviceId, characteristicId, obj.laveData);
      } else {
        writeDevicePwd(deviceId, serviceId, characteristicId, null);
      }
    },
    fail: function(res) {
      //console.log(257);
    }
  })
}

function writeDevicePwd(deviceId, serviceId, characteristicId, data) {
  var obj = {},
    frameControl = 0;
  sequenceControl = parseInt(sequenceControl) + 1;
  if (!util._isEmpty(data)) {
    obj = util.isSubcontractor(data, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  } else {
    var pwdData = getCharCodeat(self.data.password);
    obj = util.isSubcontractor(pwdData, self.data.isChecksum, sequenceControl, self.data.isEncrypt);
    frameControl = util.getFrameCTRLValue(self.data.isEncrypt, self.data.isChecksum, util.DIRECTION_OUTPUT, false, obj.flag);
  }
  var defaultData = util.encrypt(aesjs, self.data.md5Key, sequenceControl, obj.lenData, true);
  var value = util.writeData(util.PACKAGE_VALUE, util.SUBTYPE_SET_PWD, frameControl, sequenceControl, obj.len, defaultData);
  var typedArray = new Uint8Array(value)

  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {
      if (obj.flag) {
        writeDevicePwd(deviceId, serviceId, characteristicId, obj.laveData);
      } else {
        writeDeviceEnd(deviceId, serviceId, characteristicId, null);
      }
    },
    fail: function(res) {}
  })
}

function writeDeviceEnd(deviceId, serviceId, characteristicId) {
  sequenceControl = parseInt(sequenceControl) + 1;
  var frameControl = util.getFrameCTRLValue(self.data.isEncrypt, false, util.DIRECTION_OUTPUT, false, false);
  var value = util.writeData(self.data.PACKAGE_CONTROL_VALUE, util.SUBTYPE_END, frameControl, sequenceControl, 0, null);
  var typedArray = new Uint8Array(value)
  wx.writeBLECharacteristicValue({
    deviceId: deviceId,
    serviceId: serviceId,
    characteristicId: characteristicId,
    value: typedArray.buffer,
    success: function(res) {

    },
    fail: function(res) {

    }
  })
}

function init() {

  let mOnFire = require("other/onfire.js");
  mDeviceEvent = require('xBlufi.js');

  util = require('../../utils/blufi/util.js');
  crypto = require('../../utils/blufi/crypto/crypto-dh.js');
  md5 = require('../../utils/blufi/crypto/md5.min.js');
  aesjs = require('../../utils/blufi/crypto/aes.js');

  wx.onBLEConnectionStateChange(function(res) {
    let obj = {
      'type': mDeviceEvent.XBLUFI_TYPE.TYPE_STATUS_CONNECTED,
      'result': res.connected,
      'data': res
    }
    mDeviceEvent.notifyDeviceMsgEvent(obj);
  })

  mDeviceEvent.listenStartDiscoverBle(true, function(options) {

    if (options.isStart) {
      //第一步检查蓝牙适配器是否可用
      wx.onBluetoothAdapterStateChange(function(res) {
        if (!res.available) {
          console.log('蓝牙适配器不可用')
        }
      });
      //第二步关闭适配器，重新来搜索
      // wx.closeBluetoothAdapter({
      //   complete: function(res) {
      //     console.log('--------关闭蓝牙适配器---------')
          wx.openBluetoothAdapter({
            success: function(res) {
              console.log('--------打开蓝牙适配器成功---------')
              wx.getBluetoothAdapterState({
                success: function(res) {
                  console.log('--------获取蓝牙适配器状态成功---------')
                  wx.stopBluetoothDevicesDiscovery({
                    success: function(res) {
                      console.log('--------停止蓝牙设备搜索成功---------')
                        let devicesList = [];
                        let countsTimes = 0;
                        wx.onBluetoothDeviceFound(function(devices) {
                          //剔除重复设备，兼容不同设备API的不同返回值
                          console.log('--------蓝牙设备发现---------',devices)
                          var isnotexist = true;
                          if (devices.deviceId) {
                            if (devices.advertisData) {
                              devices.advertisData = buf2hex(devices.advertisData)
                            } else {
                              devices.advertisData = ''
                            }
                            for (var i = 0; i < devicesList.length; i++) {
                              if (devices.deviceId === devicesList[i].deviceId) {
                                isnotexist = false
                              }
                            }
                            if (isnotexist) {
                              devicesList.push(devices)
                            }
                          } else if (devices.devices) {
                            
                            if(countsTimes < 200){
                              countsTimes++
                              // console.log('devices.devices',JSON.stringify(devices.devices))
                              if (devices.devices[0].advertisData) {
                                devices.devices[0].advertisData = buf2hex(devices.devices[0].advertisData)
                              } else {
                                devices.devices[0].advertisData = ''
                              }
                              for (var i = 0; i < devicesList.length; i++) {
                                if (devices.devices[0].deviceId == devicesList[i].deviceId) {
                                  devicesList[i] = devices.devices[0]
                                  isnotexist = false
                                }
                              }
                              if (isnotexist) {
                                devicesList.push(devices.devices[0])
                              } 
                            }else {
                              countsTimes = 0
                              devicesList = devices.devices.map(item=>{
                                return {
                                  ...item,
                                  advertisData:item.advertisData ? buf2hex(item.advertisData) : ''
                                }
                              })
                            }
                            
                            
                          } else if (devices[0]) {
                            if (devices[0].advertisData) {
                              devices[0].advertisData = buf2hex(devices[0].advertisData)
                            } else {
                              devices[0].advertisData = ''
                            }
                            for (var i = 0; i < devicesList.length; i++) {
                              if (devices[0].deviceId == devicesList[i].deviceId) {
                                isnotexist = false
                              }
                            }
                            if (isnotexist) {
                              devicesList.push(devices[0])
                            }
                          }

                          let obj = {
                            'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS,
                            'result': true,
                            'data': devicesList
                          }
                          mDeviceEvent.notifyDeviceMsgEvent(obj);
                        })
                        wx.startBluetoothDevicesDiscovery({
                          allowDuplicatesKey: true,
                          interval: 50,
                          success: function(res) {
                            console.log('--------开始蓝牙设备发现成功---------')
                            let obj = {
                              'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START,
                              'result': true,
                              'data': res
                            }
                            mDeviceEvent.notifyDeviceMsgEvent(obj);
                            //开始扫码，清空列表
                            devicesList.length = 0;
                            
                          },
                          fail: function(res) {
                            console.log('--------开始蓝牙设备发现失败---------')
                            let obj = {
                              'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START,
                              'result': false,
                              'data': res
                            }
                            mDeviceEvent.notifyDeviceMsgEvent(obj);
                          }
                        });
                    },
                    fail: function(res) {
                      console.log('--------停止蓝牙设备搜索失败---------')
                      let obj = {
                        'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START,
                        'result': false,
                        'data': res
                      }
                      mDeviceEvent.notifyDeviceMsgEvent(obj);
                    }
                  });
                },
                fail: function(res) {
                  console.log('--------获取蓝牙适配器状态失败---------')
                  let obj = {
                    'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START,
                    'result': false,
                    'data': res
                  }
                  mDeviceEvent.notifyDeviceMsgEvent(obj);
                }
              });
            },
            fail: function(res) {
              console.log('--------打开蓝牙适配器失败---------',JSON.stringify(res))
              let obj = {
                'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START,
                'result': false,
                'data': res
              }
              mDeviceEvent.notifyDeviceMsgEvent(obj);
            }
          });
      //   }
      // });
    } else {
      wx.stopBluetoothDevicesDiscovery({
        success: function(res) {
          console.log('-----停止搜索蓝牙成功-----')
          clearInterval(tempTimer);
          let obj = {
            'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_STOP,
            'result': true,
            'data': res
          }
          mDeviceEvent.notifyDeviceMsgEvent(obj);
        },
        fail: function(res) {
          console.log('-----停止搜索蓝牙失败-----')
          let obj = {
            'type': mDeviceEvent.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_STOP,
            'result': false,
            'data': res
          }
          mDeviceEvent.notifyDeviceMsgEvent(obj);
        }
      })
    }
  })


  mDeviceEvent.listenConnectBle(true, function(options) {
    console.log("我要连接？", (options.isStart), options.deviceId)
    
    if (options.isStart) {
      const connectOptions = {
        deviceId: options.deviceId,
        timeout: 20000,
        success: function(res) {
          console.log('------创建蓝牙连接成功--------', options.deviceId, res)
          const sys = wx.getDeviceInfo();
          const isOhos = (sys.platform || '').toLowerCase() === 'ohos';
          if (!isOhos) {
            wx.setBLEMTU({
              deviceId: options.deviceId,
              mtu: 128
            });
          }
          self.data.deviceId = options.deviceId
          mDeviceEvent.notifyDeviceMsgEvent({
            'type': mDeviceEvent.XBLUFI_TYPE.TYPE_CONNECTED,
            'result': true,
            'data': {
              deviceId: options.deviceId,
              name: options.name
            },
          });
        },
        fail: function(res) {
          console.log('------创建蓝牙连接失败--------', options.deviceId, res)
          self.data.deviceId = null
          mDeviceEvent.notifyDeviceMsgEvent({
            'type': mDeviceEvent.XBLUFI_TYPE.TYPE_CONNECTED,
            'result': false,
            'data': Object.assign({ deviceId: options.deviceId }, res),
          });
        }
      };
      wx.createBLEConnection(connectOptions);
    } else wx.closeBLEConnection({
      deviceId: options.deviceId,
      success: function(res) {
        console.log('------关闭蓝牙连接成功--------')
        self.data.deviceId = null
        mDeviceEvent.notifyDeviceMsgEvent({
          'type': mDeviceEvent.XBLUFI_TYPE.TYPE_CLOSE_CONNECTED,
          'result': true,
          'data': {
            deviceId: options.deviceId,
            name: options.name
          }
        });
      },
      fail: function(res) {
        console.log('------关闭蓝牙连接失败--------')
        self.data.deviceId = null
        mDeviceEvent.notifyDeviceMsgEvent({
          'type': mDeviceEvent.XBLUFI_TYPE.TYPE_CLOSE_CONNECTED,
          'result': false,
          'data': res,
        });
      }
    })
  })

  mDeviceEvent.listenInitBleEsp32(true, function(options) {
    sequenceControl = 0;
    sequenceNumber = -1;
    self = null
    self = {
      data: {
        deviceId: null,
        isConnected: false,
        failure: false,
        value: 0,
        desc: "请耐心等待...",
        isChecksum: true,
        isEncrypt: true,
        flagEnd: false,
        defaultData: 1,
        ssidType: 2,
        passwordType: 3,
        meshIdType: 3,
        deviceId: "",
        ssid: "",
        uuid: "",
        serviceId: "",
        password: "",
        meshId: "",
        processList: [],
        result: [],
        service_uuid: "0000FFFF-0000-1000-8000-00805F9B34FB",
        characteristic_write_uuid: "0000FF01-0000-1000-8000-00805F9B34FB",
        characteristic_read_uuid: "0000FF02-0000-1000-8000-00805F9B34FB",
        customData: null,
        md5Key: 0,
      }
    }
    let deviceId = options.deviceId
    self.data.deviceId = options.deviceId
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: function(res) {
        console.log('------获取蓝牙服务成功--------', res.services)
        var services = res.services || [];
        var serviceId = null;
        for (var si = 0; si < services.length; si++) {
          if (bleUuidMatches(services[si].uuid, self.data.service_uuid)) {
            serviceId = services[si].uuid;
            break;
          }
        }
        if (!serviceId) {
          console.error('[BluFi] 未找到 FFFF 服务');
          notifyInitEsp32Fail({ errMsg: 'BluFi service not found', services });
          return;
        }

        wx.getBLEDeviceCharacteristics({
          deviceId: deviceId,
          serviceId: serviceId,
          success: function(charRes) {
            var list = charRes.characteristics || [];
            var writeCharId = null;
            var notifyCharId = null;

            for (var ci = 0; ci < list.length; ci++) {
              var charUuid = list[ci].uuid;
              if (bleUuidMatches(charUuid, self.data.characteristic_write_uuid)) {
                writeCharId = charUuid;
              }
              if (bleUuidMatches(charUuid, self.data.characteristic_read_uuid)) {
                notifyCharId = charUuid;
              }
            }

            if (!writeCharId || !notifyCharId) {
              console.error('[BluFi] 未找到 FF01/FF02', list);
              notifyInitEsp32Fail({ errMsg: 'BluFi characteristics not found', characteristics: list });
              return;
            }

            self.data.serviceId = serviceId;
            self.data.uuid = writeCharId;
            console.log('[BluFi] 写入特征:', writeCharId, 'notify特征:', notifyCharId);

            wx.notifyBLECharacteristicValueChange({
              state: true,
              deviceId: deviceId,
              serviceId: serviceId,
              characteristicId: notifyCharId,
              success: function() {
                if (!bleNotifyListenerRegistered) {
                  wx.onBLECharacteristicValueChange(handleBleCharacteristicNotify);
                  bleNotifyListenerRegistered = true;
                }
                // GoodSleep 走自定义明文配网，跳过 BluFi DH 安全握手
                console.log('[BluFi] FF02 notify 已开启，初始化完成');
                notifyInitEsp32Success(deviceId, serviceId, writeCharId, notifyCharId);
              },
              fail: function(notifyErr) {
                console.error('[BluFi] 开启 notify 失败:', notifyErr);
                notifyInitEsp32Fail(notifyErr);
              }
            });
          },
          fail: function(res) {
            console.log('fail getBLEDeviceCharacteristics:' + JSON.stringify(res));
            notifyInitEsp32Fail(res);
          }
        });
      },
      fail: function(res) {
        console.log('fail getBLEDeviceServices:' + JSON.stringify(res));
        notifyInitEsp32Fail(res);
      }
    })
  })

  mDeviceEvent.listenSendRouterSsidAndPassword(true, function(options) {
    self.data.password = options.password
    self.data.ssid = options.ssid
    writeDeviceRouterInfoStart(self.data.deviceId, self.data.service_uuid, self.data.characteristic_write_uuid, null);
  })


  mDeviceEvent.listenSendCustomData(true, function(options) {
    self.data.customData = options.customData
    writeCutomsData(self.data.deviceId, self.data.service_uuid, self.data.characteristic_write_uuid, null);
  })
}


/****************************** 对外  ***************************************/
module.exports = {
  init: init,
};
