
/*
 * 创建 logs 日志文件夹
 * */
try {
    require('fs').mkdirSync('./logs');
    require('fs').mkdirSync('./files');
} catch (e) {
    if (e.code !== 'EEXIST') {
        console.error("Could not set up log directory, error was: ", e);
        process.exit(1);
    }
}

const { applog, dev, sql, order } = require('./log');
global.OUT = applog;
global.DEV = dev;
global.SQL = sql;
global.ORDER = order;
global.Promise = require('bluebird');

const Koa = require('koa')
const path = require('path')
const app = new Koa()
const cors = require('kcors')
const json = require('koa-json')
const compress = require('koa-compress')
const bodyParser = require('koa-bodyparser')
const favicon = require('koa-favicon');
const helmet = require('koa-helmet')
const serve = require('koa-static');
const Router = require('koa-router');
const router = new Router();
const mount = require('koa-mount');
const config = require('./config');
const Routes = require('./routes');
const connect = require('./connect');
const log4js = require('koa-log4');
const respond = require('koa-respond');

app.use(bodyParser())
app.use(helmet())
app.use(cors({
    credentials: true
}))
app.use(json())
app.use(respond());
app.use(log4js.koaLogger(OUT, { level: 'auto', nolog: ["\\.jpg$","\\.jpeg$", "\\.png", "\\.ico", "\\.js", "\\.css", "\\.json"] }))
app.use(compress())
app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(serve(__dirname + '/public'));
app.use(mount('/docs', serve(__dirname + '/docs')));

/*********** API 文档配置 start ***************/
if (config.env === "local") {
    const swaggerJSDoc = require('swagger-jsdoc');
    const swaggerDefinition = {
        info: {
            title: '后端 server API 接口文档',
            version: '1.0.0',
            description: `后端 server开发 API 接口文档说明,所以的 API 正确返回格式都是 {code: 0, data: {返回数据}}, 
            错误的返回是 {code: 1, msg: "错误的返回原因"} 错误返回的 code 就是不等于 0 的其他数,然后这些数在文档里面都会有写!
            {code: 101, msg: "该接口必须要有 token 参数!"}
{code: 102, msg: "token 已过期,请重新登录!"}
{code: 103, msg: "token 错误,请重新登录!"}
{code: 104, msg: "不存在该用户!"}
{code: 105, msg: '用户修改密码,请重新登录!'}
{code: 106, msg: '您涉嫌违规操作,账户被停用,如有异议请联系我们!'}
其他异常报错
{code: 500, msg: "服务器错误!"}
`,
        },
        host: '',
        basePath: '',
    };
    const options = {
        swaggerDefinition: swaggerDefinition,
        apis: ['./controllers/*.js', './routes/*/*.js', './routes/*.js', './models/*.js' ],
    };
    const swaggerSpec = swaggerJSDoc(options);
    const b = new Koa();
    b.use(async function (ctx, next){
        await next();
        ctx.body = swaggerSpec;
    });
    app.use(mount('/swagger.json', b));
    app.use(mount('/koa/swagger.json', b));
}
else if (config.env === "dev") {
    const swaggerJSDoc = require('swagger-jsdoc');
    const swaggerDefinition = {
        info: {
            title: '后端 server API 接口文档',
            version: '1.0.0',
            description: `后端 server开发 API 接口文档说明,所以的 API 正确返回格式都是 {code: 0, data: {返回数据}}, 
            错误的返回是 {code: 1, msg: "错误的返回原因"} 错误返回的 code 就是不等于 0 的其他数,然后这些数在文档里面都会有写!
            {code: 101, msg: "该接口必须要有 token 参数!"}
{code: 102, msg: "token 已过期,请重新登录!"}
{code: 103, msg: "token 错误,请重新登录!"}
{code: 104, msg: "不存在该用户!"}
{code: 105, msg: '用户修改密码,请重新登录!'}
{code: 106, msg: '您涉嫌违规操作,账户被停用,如有异议请联系我们!'}
其他异常报错
{code: 500, msg: "服务器错误!"}
`,
        },
        host: '',
        basePath: '/koa',
    };
    const options = {
        swaggerDefinition: swaggerDefinition,
        apis: ['./controllers/*.js', './routes/*/*.js', './routes/*.js', './models/*.js' ],
    };
    const swaggerSpec = swaggerJSDoc(options);
    const b = new Koa();
    b.use(async function (ctx, next){
        await next();
        ctx.body = swaggerSpec;
    });
    app.use(mount('/swagger.json', b));
    app.use(mount('/koa/swagger.json', b));
}
/*********** API 文档配置 end ***************/
const User = require('./models/user');
require('./core/passport').setup(User);
app.use(Routes.routes());


// Start server
app.listen(config.port, function () {
    OUT.info('Koa server listening on port http://localhost:' + config.port)
})
