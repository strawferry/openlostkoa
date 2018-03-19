
const log4js = require("log4js");

const devurl = 'https://oapi.dingtalk.com/robot/send?access_token=a27fcd14f3de83d651ca529c461d2ffdf18a7fd853d189417e9c8eef584a338b';
const orderurl = 'https://oapi.dingtalk.com/robot/send?access_token=a27fcd14f3de83d651ca529c461d2ffdf18a7fd853d189417e9c8eef584a338b'; // 测试
// const orderurl = 'https://oapi.dingtalk.com/robot/send?access_token=6d80df7b0e3d7bb61a34e704c7ea638e00eec008b523fd4ec8827b93da9332cb'; // 正式的

log4js.configure({
    pm2: true,
    appenders: {
        out: { type: 'stdout' },
        devD: {
            type: 'log4jsdd',
            hookUrl: devurl,
            title: '服务器开发发来消息'
        },
        orderD: {
            type: 'log4jsdd',
            hookUrl: orderurl,
            title: '恭喜发财,订单消息来啦!'
        },
        file: { type: 'dateFile', filename: 'logs/out.log', keepFileExt: true},
        order: { type: 'dateFile', filename: 'logs/order.log', keepFileExt: true},
        dev: { type: 'dateFile', filename: 'logs/dev.log', keepFileExt: true},
        sql: { type: 'dateFile', filename: 'logs/sql.log', keepFileExt: true},
    },
    categories: {
        default: { appenders: [ 'out', 'file'], level: 'all'},
        sql: { appenders: [ 'out', 'file', 'sql'], level: 'all'},
        order: { appenders: [ 'out', 'file', 'sql', 'order', 'orderD'], level: 'all'},
        dev: { appenders: [ 'out', 'file', 'devD', 'dev'], level: 'all'},
    }
});

// 可以配置钉钉的机器人插件,用于发送钉钉消息,可以做针对的东西,比如订单,还有每天的总结,只要写好了程序做定时就行,吧基本接口写好就行

const app = log4js.getLogger();
const dev = log4js.getLogger('dev');
const sql = log4js.getLogger('sql');
const order = log4js.getLogger('order');

exports.applog = app;
exports.dev = dev;
exports.sql = sql;
exports.order = order;
