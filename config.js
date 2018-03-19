
const path = require('path');
const rootPath = path.normalize(__dirname);
const port = process.env.PORT || 5566;
const host = process.env.HOST || `localhost:5566`;
const secret = "SECRET_TOKEN";
const env = process.env.NODE_ENV || 'dev';

const qiniu = {
    ACCESS_KEY: "you_access_key",
    SECRET_KEY: "you_secret_key",
    public: {
        bucketName: "you_bucketName",
        domain: "you_domain"
    }
};

const jpush = {
    APP_KEY: "you_app_key",
    MASTER_SECRET: "you_master_secret"
};


let dev = {
    env: env,
    secret,
    qiniu,
    jpush,
    root: rootPath,
    port: port,
    host: host,
    db: "mongodb://localhost:27017/lostserver",
    jwt: {
        tokenSecret: 'TOKEN_SECRET',
        expTime: '200h',
        isIgnore: true
    }
    
};



let local = {};
if (env === 'local'){
    local = {
        env: env
    };
}

let prod = {};
if (env === 'prod'){
    prod = {
        env: env,
        port: 7878,
        schedulePort: 7879,
    };
}

let config = dev;
config = Object.assign(config, local, prod);
console.log(config);
module.exports = config;





