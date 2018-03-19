'use strict';
const Promise = require('bluebird');
const _ = require('lodash');
const jwt = require('jsonwebtoken');
const config = require('./../config');

let security = {};
module.exports = security;



security.generateToken = function (payload) {
    return jwt.sign(payload, config.jwt.tokenSecret, {expiresIn: config.jwt.expTime});
};

security.verifyToken = function (token) {
    return new Promise((resolve, reject)=>{
        const tokenSecret = _.get(config, 'jwt.tokenSecret');
        const isIgnore = _.get(config, 'jwt.isIgnore');
        jwt.verify(token, tokenSecret, {ignoreExpiration: isIgnore}, function (err, authData) {
            if (err) {  //  时间失效的时候/ 伪造的token
                if(err.name == 'TokenExpiredError'){
                    reject({code: 102});
                }else {
                    reject({code: 103});
                }
            } else {
                resolve(authData);
            }
        });
    });
};


security.sortJsonToArr = function (json) {
  const rs = [];
  _.forIn(json, (value, key) => {
    rs.push({path:key, hash: value})
  });
  return _.sortBy(rs, (o) => o.path);
};

//仿PHP的rand函数
function rand(min, max) {
    return Math.random()*(max-min+1) + min | 0; //特殊的技巧，|0可以强制转换为整数
}

security.randCode = function randCode(num = 4) {
    let p = "ABCDEFGHKMNPQRSTUVWXYZ3456789";
    let str = '';
    for(let i=0; i< num; i++){
        str += p.charAt(Math.random() * p.length |0);
    }
    return str;
};


security.strsub = function(str, length = 10) {
    if(str.length < length){
        return str;
    }else{
        return str.substr(0, length) + '...';
    }

};
