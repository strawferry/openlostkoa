


const Security = require('./Security');
const Message = require('./Message');
const User = require('./../models/user');
const _ = require('lodash');
const compose = require('koa-compose');
const middleware = {};
module.exports = middleware;


middleware.checkToken = function checkToken() {
    return compose([
        async (ctx,next)=> {
        let token = _.get(ctx.request.body, 'token', null) || _.get(ctx.query, 'token', null) || _.get(ctx.headers, 'x-access-token', null) || false;
        if(token){
            ctx.token = token;
            OUT.trace(`传入的TOKEN:\n${token}`);
            await next();
        }else{
            return ctx.ok({code: 101, msg: '该接口必须要有 token 参数!'})
        }
        },
        async (ctx,next)=> {
        try{
            let user = await Security.verifyToken(ctx.token);
            let uUser = await User.findOne({_id: user._id}, "_id  userName avatar email tel createTime token status role");
            OUT.trace(`TOKEN解析出USER:\n${JSON.stringify(uUser)}`);
            if (uUser) {
                /*
                * 单端登录,或者可以设置 3-5 端登录;
                * */
                // if (uUser.token === token){
                //     ctx.user = uUser;
                //     next();
                // }else{
                //     return ctx.ok(Message.error(200, "token 过期或者失效了,请重新登录!"));
                // }
                if(uUser.status === 0){
                    ctx.ok(Message.error(200, '您涉嫌违规操作,账户被停用,如有异议请联系我们!'));
                }else{
                    ctx.user = uUser;
                    await next();
                }
            } else {
                return ctx.ok(Message.error(100, 'can\'t find the user'));
            }
        } catch (err){
            if(err.code === 102){
                // token 已过期,请重新登录!
                return ctx.ok(Message.error({code: 102, msg: 'token 已过期,请重新登录!'}));
            }
            if(err.code === 103){
                // token 错误,请重新登录!
                return ctx.ok(Message.error({code: 103, msg: 'token 错误,请重新登录!'}));
            }
            return ctx.throw(err)
        }
         }
    ])
};

middleware.logParams = async (ctx,next)=> {
    let body = _.get(ctx.request, 'body', null);
    let query = _.get(ctx, 'query', null);
    OUT.trace(`路由:${ctx.originalUrl} \n 请求传入:-query-:${JSON.stringify(query)} \n body-:${JSON.stringify(body)}`);
    await next();
};



