// Copyright (c) 2022 Zego, Inc. All rights reserved.
// This source code is licensed under the MIT-style license found in the
// LICENSE file in the root directory of this source tree.

const crypto = require('crypto');

var ErrorCode = {
    SUCCESS: 0,
    APP_ID_INVALID: 1,
    USER_ID_INVALID: 3,
    SECRET_INVALID: 5,
    EFFECTIVE_TIME_INVALID: 6
};

function RndNum(a, b) {
    return Math.ceil((a + (b - a)) * Math.random());
}

function MakeNonce() {
    return RndNum(-2147483648, 2147483647);
}

function MakeRandomIv() {
    var str = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = [];
    for (var i = 0; i < 16; i++) {
        var r = Math.floor(Math.random() * str.length);
        result.push(str.charAt(r));
    }
    return result.join('');
}

function GetTime() {
    return Math.floor(new Date().getTime() / 1000);
}

function AesEncrypt(plainText, key, iv) {
    var cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(true);
    var Crypted = cipher.update(plainText, 'utf-8', 'base64');
    Crypted += cipher.final('base64');
    return Crypted;
}

var ZegoServerAssistant = (function () {
    var _a;
    var ZegoServerAssistant = (_a = (function () {
        function ZegoServerAssistant() {
        }
        ZegoServerAssistant.generateToken04 = function (appId, userId, secret, effectiveTimeInSeconds, payload) {
            if (!appId || typeof appId !== 'number') {
                throw {
                    errorCode: ErrorCode.APP_ID_INVALID,
                    errorMessage: 'appId invalid'
                };
            }
            if (!userId || typeof userId !== 'string') {
                throw {
                    errorCode: ErrorCode.USER_ID_INVALID,
                    errorMessage: 'userId invalid'
                };
            }
            if (!secret || typeof secret !== 'string' || secret.length !== 32) {
                throw {
                    errorCode: ErrorCode.SECRET_INVALID,
                    errorMessage: 'secret must be a 32 byte string'
                };
            }
            if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
                throw {
                    errorCode: ErrorCode.EFFECTIVE_TIME_INVALID,
                    errorMessage: 'effectiveTimeInSeconds invalid'
                };
            }
            var createTime = GetTime();
            var tokenInfo = {
                app_id: appId,
                user_id: userId,
                nonce: MakeNonce(),
                ctime: createTime,
                expire: createTime + effectiveTimeInSeconds,
                payload: payload || ''
            };
            var plaintText = JSON.stringify(tokenInfo);
            var iv = MakeRandomIv();
            var encryptBuf = AesEncrypt(plaintText, secret, iv);
            var _a = [new Uint8Array(8), new Uint8Array(2), new Uint8Array(2)], b1 = _a[0], b2 = _a[1], b3 = _a[2];
            new DataView(b1.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);
            new DataView(b2.buffer).setInt16(0, iv.length, false);
            new DataView(b3.buffer).setInt16(0, encryptBuf.length, false);
            var buf = Buffer.from(JSON.stringify({
                'iv': iv,
                'cipherText': encryptBuf
            }));
            var finalBuf = Buffer.concat([Buffer.from(b1), Buffer.from(b2), Buffer.from(iv), Buffer.from(b3), buf]);
            var token = '04' + Buffer.from(finalBuf).toString('base64');
            return token;
        };
        return ZegoServerAssistant;
    }()),
        _a.ErrorCode = ErrorCode,
        _a);
    return ZegoServerAssistant;
}());

exports.ZegoServerAssistant = ZegoServerAssistant;
