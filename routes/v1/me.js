


'use strict';

const router = require('koa-router')();
const _ = require('lodash');
const bcrypt = require('bcrypt-nodejs');
const passport = require('koa-passport');
const User = require('./../../models/user');
const Collection = require('./../../models/collection');
const Post = require('./../../models/post');
const Security = require('./../../core/Security');
const MiddleWare = require('./../../core/MiddleWare');
const Message = require('./../../core/Message');
const jpush =  require('./../../controllers/jpush/index');
const ziji = "_id userID userName avatar email tel createTime token status role agency";
const notoken = "_id userID userName avatar email tel createTime status role";
const postuser = "_id userID userName avatar createTime status role";


/**
 * @swagger
 * /v1/me/register:
 *   post:
 *     operationId: register
 *     tags:
 *       - 账户模块
 *     description: 用户注册
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         description: 注册需要邮箱和密码
 *         required: true
 *         schema:
 *           $ref: '#/definitions/Login'
 *     responses:
 *       200:
 *         description: >-
 *           ```
 *            错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: '必须输入参数!'}
 *                  {code: 3, msg: '用户已经存在!'}
 *            正确返回
 *                  {code: 0, data: "注册成功,快去登录吧!"}
 *            ```
 */
router.post('/register', MiddleWare.logParams, async (ctx, next)=>{
        let body = ctx.request.body;
    let email = _.get(body, 'email', null);
    let password = _.get(body, 'password', null);
    if (_.isEmpty(_.trim(email))) { return ctx.ok({code: 2, msg: '必须输入参数 email!'})}
    if (_.isEmpty(_.trim(password))) {return ctx.ok({code: 2, msg: '必须输入参数 password!'})}

    try{
            let auser = await User.findOne({email: email});
        if(auser){
            return ctx.ok({code: 3, msg: '用户已经存在!'});
        }
        const salt = bcrypt.genSaltSync();
        let newUser = new User({
            email: email,
            password: bcrypt.hashSync(password, salt),
        });
        const user = await newUser.save();
        ctx.ok({code: 0, data: "注册成功,快去登录吧!"});
    }catch(err){
        ctx.throw(err)
    }
});

/**
 * @swagger
 * /v1/me/login:
 *   post:
 *     operationId: login
 *     tags:
 *       - 账户模块
 *     description: 用户登录
 *     consumes:
 *        - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: body
 *         name: body
 *         description: 登录需要邮箱和密码
 *         required: true
 *         schema:
 *           $ref: '#/definitions/Login'
 *     responses:
 *       200:
 *         description: >-
 *           ```
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: "输入邮箱不对!"}
 *                  {code: 3, msg: "输入密码和邮箱不匹配!"}
 *                  {code: 4, msg: "缺少邮箱或者密码!"}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.post('/login', MiddleWare.logParams, async (ctx, next)=>{
    await passport.authenticate('local', async (err, user, info)=> {
        try{
            if (err) {ctx.throw(err);}
            if(info){ctx.status = 403; return ctx.body = info;}

            let token = Security.generateToken({
                _id : user._id,
                email : user.email,
            });
            user.password=undefined;
            user.token=token;
            let nuser = await User.findByIdAndUpdate(user._id, {token: token}, {new: true, select: ziji});
            ctx.ok({code: 0, data: nuser});
        }catch(err){
            ctx.throw(err)
        }
    })(ctx, next)
});

/**
 * @swagger
 * /v1/me/syncstatus:
 *   get:
 *     operationId: syncstatus
 *     tags:
 *       - 账户模块
 *     description: 同步服务器登录状态 app 小程序 专用
 *     security:
 *       - token: []
 *     responses:
 *       200:
 *         description: >-
 *           ```
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.get('/syncstatus', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    ctx.ok(Message.sucess(ctx.user))
});


/**
 * @swagger
 * /v1/me/addcollection/{id}:
 *   get:
 *     operationId: addcollection
 *     tags:
 *       - 操作
 *     description: 收藏启事
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *     - name: id
 *       in: path
 *       description: 启事 id
 *       required: true
 *       type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: '您已经收藏过该启事!'}
 *                  {code: 3, msg: "收藏失败,服务器错误!"}
 *                  {code: 4, msg: "传入参数有误"}
 *                  {code: 5, msg: "启事id不能为空!"}
 *              正确返回
 *                  {code: 0, data: '收藏成功!'}
 *            ```
 */
router.get('/addcollection/:id', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    if (!ctx.params.id){return ctx.ok(Message.error({code: 5, msg: "启事id不能为空!"}));}

        try {
            let post = await Post.findById(ctx.params.id).populate("user", notoken).populate({path: 'beCollection', select: notoken});

            if (post){

               let acollect = await Collection.findOne({user: ctx.user._id , post: post._id});

                if(acollect){
                    return ctx.ok(Message.error({code: 2, msg: '您已经收藏过该启事!'}));
                }else{
                    let collection = new Collection({
                        user: ctx.user._id,
                        post: post._id
                    });
                    let temp = [];
                    if(post.beCollection){
                        temp = post.beCollection;
                    }
                    temp.push(ctx.user._id);
                    post.beCollection = temp;
                    let npost = await post.save();
                    let ncollection = await collection.save();
                    ctx.ok(Message.sucess('收藏成功!'));
                }
            }else{
                return ctx.ok(Message.error({code: 4, msg: "传入参数有误"}));
            }
        } catch (err){
            ctx.throw(err);
        }
});

/**
 * @swagger
 * /v1/me/delcollection/{id}:
 *   get:
 *     operationId: delcollection
 *     tags:
 *       - 操作
 *     description: 取消收藏启事
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *     - name: id
 *       in: path
 *       description: 启事 id
 *       required: true
 *       type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: '您还未收藏该启事,所以不能取消收藏!'}
 *                  {code: 3, msg: "收藏失败,服务器错误!"}
 *                  {code: 4, msg: "传入参数有误"}
 *                  {code: 5, msg: "启事id不能为空!"}
 *              正确返回
 *                  {code: 0, data: '取消收藏成功!'}
 *            ```
 */
router.get('/delcollection/:id', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    if (!ctx.params.id){return res.json({code: 5, msg: "启事id不能为空!"});}

    try{
       let post = await Post.findById(ctx.params.id).populate("user", notoken);
       if (post){
           let acollect = await Collection.findOne({ user: ctx.user._id , post: post._id });
           if(acollect){
              await Collection.findByIdAndRemove(acollect._id);
               let temp = post.beCollection;
               temp.splice(temp.indexOf(ctx.user._id), 1);
               post.beCollection = temp;
               await post.save();
               return ctx.ok(Message.sucess('取消收藏成功!'));
           }else{
               return ctx.ok(Message.error({code: 2, msg: '您还未收藏该启事,所以不能取消收藏!'}));
           }

        }else{
            return ctx.ok(Message.error({code: 4, msg: "传入参数有误"}));
        }
} catch (err){
    ctx.throw(err);
}
});

/**
 * @swagger
 * /v1/me/myxwlist:
 *   get:
 *     operationId: myxwlist
 *     tags:
 *       - 我的列表
 *     description: 我的寻物启事
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: postID
 *        in: query
 *        description: 启事 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: lostStatus
 *        in: query
 *        description: 启事状态 0 未结束 1 已结束
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              postID 传过来的 postID
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *              正确返回
 *                  {code: 0, data: posts}
 *            ```
 */

router.get('/myxwlist', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    let option = {type: 0, user: ctx.user._id}, // 寻物启事
        limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
        postID = ctx.query.postID ? ctx.query.postID : null,
        sort = ctx.query.sort ? ctx.query.sort : null,
        sortStatus = -1;

    ctx.query.lostStatus ? option.lostStatus = Number(ctx.query.lostStatus) : null;
    // 最新数据 大到小排列
    if (postID) {
        if (sort) {
            if (sort === "more") {
                option._id = {$lt: postID};
                sortStatus = -1;
            } else if (sort === "new") {
                option._id = {$gt: postID};
                sortStatus = 1;
            }
        }
    }

    // 1. 默认情况下,第一次加载,无 postID, sort 默认为 -1
    // 2. 有 postID sort=more,加载更多,获取比 postID 小的数据  sort 为 -1,数据方向正确,直接传给前端,直接 push 进数组
    // 3. 有 postID sort=new,获取比他更新的数据,或者说是 postID 大的数据 sort 为 1,数据方向相反,数据 reverse 传给前端,直接 shift 进数组

    try{
        let posts = await Post.find(option).sort({"_id": sortStatus}).limit(limit).populate('user', postuser);
        if (sort === "new") {
            ctx.ok(Message.sucess(posts.reverse()));
        } else {
            ctx.ok(Message.sucess(posts));
        }
    } catch (err){
        ctx.throw(err);
    }

});


/**
 * @swagger
 * /v1/me/myzllist:
 *   get:
 *     operationId: myzllist
 *     tags:
 *       - 我的列表
 *     description: 我的招领启事
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: postID
 *        in: query
 *        description: 启事 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: lostStatus
 *        in: query
 *        description: 启事状态 0 未结束 1 已结束
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              postID 传过来的 postID
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *              正确返回
 *                  {code: 0, data: posts}
 *            ```
 */
router.get('/myzllist', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    let option = {type: 1, user: ctx.user._id}, // 招领启事
        limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
        postID = ctx.query.postID ? ctx.query.postID : null,
        sort = ctx.query.sort ? ctx.query.sort : null,
        sortStatus = -1;

    ctx.query.lostStatus ? option.lostStatus = Number(ctx.query.lostStatus) : null;
    // 最新数据 大到小排列
    if (postID) {
        if (sort) {
            if (sort === "more") {
                option._id = {$lt: postID};
                sortStatus = -1;
            } else if (sort === "new") {
                option._id = {$gt: postID};
                sortStatus = 1;
            }
        }
    }
    // 1. 默认情况下,第一次加载,无 postID, sort 默认为 -1
    // 2. 有 postID sort=more,加载更多,获取比 postID 小的数据  sort 为 -1,数据方向正确,直接传给前端,直接 push 进数组
    // 3. 有 postID sort=new,获取比他更新的数据,或者说是 postID 大的数据 sort 为 1,数据方向相反,数据 reverse 传给前端,直接 shift 进数组
    try{
        let posts = await Post.find(option).sort({"_id": sortStatus}).limit(limit).populate('user', postuser);
        if (sort === "new") {
            ctx.ok(Message.sucess(posts.reverse()));
        } else {
            ctx.ok(Message.sucess(posts));
        }
    } catch (err){
        ctx.throw(err);
    }

});


/**
 * @swagger
 * /v1/me/mycollection:
 *   get:
 *     operationId: mycollection
 *     tags:
 *       - 我的列表
 *     description: 我的收藏列表
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: collection_id
 *        in: query
 *        description: 收藏 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              collection_id 传过来的 collection_id
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束
 *              最新数据,就是往 collection_id 大的,反之往 collection_id 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *              正确返回
 *                  {code: 0, data: collections}
 *            ```
 */
router.get('/mycollection', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    let option = {user: ctx.user._id}, // 招领启事
        limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
        collection_id = ctx.query.collection_id ? ctx.query.collection_id : null,
        sort = ctx.query.sort ? ctx.query.sort : null,
        sortStatus = -1;

    // 最新数据 大到小排列
    if (collection_id) {
        if (sort) {
            if (sort === "more") {
                option._id = {$lt: collection_id};
                sortStatus = -1;
            } else if (sort === "new") {
                option._id = {$gt: collection_id};
                sortStatus = 1;
            }
        }
    }

    // 1. 默认情况下,第一次加载,无 postID, sort 默认为 -1
    // 2. 有 postID sort=more,加载更多,获取比 postID 小的数据  sort 为 -1,数据方向正确,直接传给前端,直接 push 进数组
    // 3. 有 postID sort=new,获取比他更新的数据,或者说是 postID 大的数据 sort 为 1,数据方向相反,数据 reverse 传给前端,直接 shift 进数组
try{
  let collections = await Collection.find(option, "post collection_id date").sort({"_id": sortStatus}).limit(limit).populate('post');
    if (sort === "new") {
        ctx.ok(Message.sucess(collections.reverse()));
    } else {
        ctx.ok(Message.sucess(collections));
    }
} catch (err){
    ctx.throw(err);
}
});

/**
 * @swagger
 * /v1/me/tweetlist:
 *   get:
 *     operationId: tweetlist
 *     tags:
 *       - 管理员列表
 *     description: 启事审核列表
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: postID
 *        in: query
 *        description: 启事 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: status
 *        in: query
 *        description:  启事的审核状态, 0 待审核 1 审核通过 2 审核不通过,不显示前端,邮件通知发布者
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *          - 2
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              postID 传过来的 postID
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              status 启事的审核状态, 0 待审核 1 审核通过 2 审核不通过,不显示前端,邮件通知发布者
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: '您没有权限查看该数据!'}
 *              正确返回
 *                  {code: 0, data: posts}
 *            ```
 */
router.get('/tweetlist',MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    if(ctx.user.role > 0){
        let option = {},
            limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
            postID = ctx.query.postID ? ctx.query.postID : null,
            sort = ctx.query.sort ? ctx.query.sort : null,
            sortStatus = -1;

        ctx.query.status ? option.status = Number(ctx.query.status) : option.status = 0;
        // 最新数据 大到小排列
        if (postID) {
            if (sort) {
                if (sort === "more") {
                    option._id = {$lt: postID};
                    sortStatus = -1;
                } else if (sort === "new") {
                    option._id = {$gt: postID};
                    sortStatus = 1;
                }
            }
        }
        try {
            let posts = await Post.find(option).sort({"_id": sortStatus}).limit(limit).populate('user', postuser);
            if (sort === "new") {
                ctx.ok(Message.sucess(posts.reverse()));
            } else {
                ctx.ok(Message.sucess(posts));
            }
        } catch (err){
            ctx.throw(err);
        }
    }else{
        ctx.ok(Message.error({code: 2, msg: '您没有权限查看该数据!'}));
    }
});

/**
 * @swagger
 * /v1/me/userlist:
 *   get:
 *     operationId: userlist
 *     tags:
 *       - 管理员列表
 *     description: 人员审核列表
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: userID
 *        in: query
 *        description: 用户 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: status
 *        in: query
 *        description: 用户状态0 删除,违规用户 1 正常用户
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              postID 传过来的 postID
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *                  {code: 2, msg: '您没有权限查看该数据!'}
 *              正确返回
 *                  {code: 0, data: posts}
 *            ```
 */
router.get('/userlist', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    if(ctx.user.role > 0){
        let option = {},
            limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
            userID = ctx.query.userID ? ctx.query.userID : null,
            sort = ctx.query.sort ? ctx.query.sort : null,
            sortStatus = -1;

        ctx.query.status ? option.status = Number(ctx.query.status) : option.status = 0;
        if (ctx.query.role){
            if(ctx.user.role > 1){
                ctx.query.role ? option.role = Number(ctx.query.role) : option.role = 0;
            }else{
                return res.json({code: 2, msg: 'ctx.user.role > 1您没有权限查看该数据!'})
            }
        }

        // 最新数据 大到小排列
        if (userID) {
            if (sort) {
                if (sort === "more") {
                    option._id = {$lt: userID};
                    sortStatus = -1;
                } else if (sort === "new") {
                    option._id = {$gt: userID};
                    sortStatus = 1;
                }
            }
        }

        try{
           let users = await User.find(option, notoken).sort({"_id": sortStatus}).limit(limit);
            if (sort === "new") {
                ctx.ok(Message.sucess(users.reverse()));
            } else {
                ctx.ok(Message.sucess(users));
            }
        } catch (err){
            ctx.throw(err);
        }
    }else{
        ctx.ok(Message.error({code: 2, msg: 'role > 0 您没有权限查看该数据!'}));
    }
});

/**
 * @swagger
 * /v1/me/setstatus:
 *   get:
 *     operationId: setstatus
 *     tags:
 *       - 操作
 *     description: 更改人员权限,和状态
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: _id
 *        in: query
 *        description: 用户 id,必填
 *        required: true
 *        type: string
 *      - name: status
 *        in: query
 *        description: 用户状态 0 删除,违规用户 1 正常用户, role 和 status 二者必须选填其一
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: role
 *        in: query
 *        description: 人员权限 0 正常用户, 1 管理员-审核文章 2 超级管理员-可以添加管理员以及审核文章, role 和 status 二者必须选填其一
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *          - 2
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              limit 每次请求多少条,可空,默认 10 条
 *              postID 传过来的 postID
 *              sort 加载方式 more 上拉加载更多, new 下拉,加载更新的
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: '不能修改自己的权限!'}
 *                  {code: 2, msg: '您修改的 status 不变,没有必要修改!'}
 *                  {code: 3, msg: '您权限低于该用户,所以无权修改!'}
 *                  {code: 4, msg: '用户 id 有误!'}
 *                  {code: 5, msg: '您修改的 role 不变,没有必要修改!'}
 *                  {code: 6, msg: '不能设置超级管理员权限!'}
 *                  {code: 7, msg: '参数有误,必须传入你要修改的 status 或者 role!'}
 *                  {code: 8, msg: '参数有误,必须传入用户id!'}
 *                  {code: 9, msg: '您没有权限查看该数据!'}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.get('/setstatus', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    if(ctx.user._id == ctx.query._id){
        res.json({code: 1, msg: '不能修改自己的权限!'});
    }else{
        if(ctx.user.role > 0){
            let id = ctx.query._id,
                status = ctx.query.status,
                role = ctx.query.role;
            if (id){
                if (status || role){
                    try{
                        if(status){
                            let user = await User.findById(id);
                            if(user){
                                if(ctx.user.role > user.role){
                                    if(user.status == status){
                                        return ctx.ok(Message.error({code: 2, msg: '您修改的 status 不变,没有必要修改!'}));
                                    }else{
                                        let newUser = await User.findByIdAndUpdate(id, { status: status}, {new: true, select: notoken});
                                        if(newUser){
                                            if(newUser.status === 0){
                                                console.log('---set alias---');
                                                await jpush.alias([String(newUser._id)], "您的账户目前已经被限制操作!", 0, {type: "user", user: newUser._id});
                                            }else if(newUser.status === 1){
                                                console.log('---set alias---');
                                                await jpush.alias([String(newUser._id)], "您的账户目前已经解除限制操作!", 0, {type: "user", user: newUser._id});
                                            }
                                            return ctx.ok(Message.sucess(newUser));
                                        }else{
                                            return ctx.ok(Message.error({code: 1, msg: '服务器错误!'}));
                                        }
                                    }

                                }else{
                                    return ctx.ok(Message.error({code: 3, msg: '您权限低于该用户,所以无权修改!'}));
                                }

                            }else {
                                return ctx.ok(Message.error({code: 4, msg: '用户 id 有误!'}));
                            }
                        }

                        if(role){
                            if(role < 2){
                                let user = await User.findById(id);
                                if(user){
                                    if(ctx.user.role > user.role){
                                        if(user.role == role){
                                            return ctx.ok(Message.error({code: 5, msg: '您修改的 role 不变,没有必要修改!'}));
                                        }else{
                                            let newUser = await User.findByIdAndUpdate(id, { role: role}, {new: true, select: notoken});
                                            if(newUser){
                                                console.log(newUser);
                                                if(newUser.role === 0){
                                                    console.log('---set alias---');
                                                    await jpush.alias([String(newUser._id)], "您已经被解除管理员权限!", 0, {type: "user", user: newUser._id});
                                                }else if(newUser.role === 1){
                                                    console.log('---set alias---');
                                                    await jpush.alias([String(newUser._id)], "您已经加入管理员权限!", 0, {type: "user", user: newUser._id});
                                                }
                                                return ctx.ok(Message.sucess(newUser));
                                            }else{
                                                return ctx.ok(Message.error({code: 1, msg: '服务器错误!'}));
                                            }
                                        }

                                    }else{
                                        return ctx.ok(Message.error({code: 3, msg: '您权限低于该用户,所以无权修改!'}));
                                    }


                                }else {
                                    return ctx.ok(Message.error({code: 4, msg: '用户 id 有误!'}));
                                }
                            }else{
                                return ctx.ok(Message.error({code: 6, msg: '不能设置超级管理员权限!'}));
                            }
                        }
                    } catch (err){
                        ctx.throw(err);
                    }

                }else{
                    return ctx.ok(Message.error({code: 7, msg: '参数有误,必须传入你要修改的 status 或者 role!'}));
                }
            }else{
                return ctx.ok(Message.error({code: 8, msg: '参数有误,必须传入用户id!'}));
            }

        }else{
            return ctx.ok(Message.error({code: 9, msg: '您没有权限查看该数据!'}));
        }
    }

});


/**
 * @swagger
 * /v1/me/setperson:
 *   post:
 *     operationId: setperson
 *     tags:
 *       - 操作
 *     description: 设置个人信息
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - in: body
 *        name: body
 *        description: 设置用户信息,用户昵称,头像,手机号码;
 *        required: true
 *        schema:
 *          $ref: '#/definitions/Info'
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              设置用户信息,用户昵称,头像,手机号码;
 *              错误返回
 *                  {code: 1, msg: '不能修改自己的权限!'}
 *                  {code: 2, msg:  "参数不能为空!"}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.post('/setperson', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    console.log(ctx.body);

    if (ctx.body.userName && ctx.body.avatar && ctx.body.tel) {
        let userName = ctx.body.userName,
            avatar = ctx.body.avatar,
            tel = ctx.body.tel;
        try{
            let newUser = await User.findByIdAndUpdate(ctx.user._id, { userName: userName, avatar: avatar, tel: tel }, {new: true, select: ziji});
            if(newUser){
                console.log(newUser);
                return ctx.ok(Message.sucess(newUser));
            }else{
                return ctx.ok(Message.error({code: 1, msg: '服务器错误!'}));
            }
        } catch (err){
            ctx.throw(err);
        }
    } else {
        return ctx.ok(Message.error({code: 2, msg:  "参数不能为空!"}));
    }
});


/**
 * @swagger
 * /v1/me/getperson/{id}:
 *   get:
 *     operationId: getperson
 *     tags:
 *       - 获取详情
 *     description: 获取个人信息
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: id
 *        in: path
 *        description: 用户 id,必填
 *        required: true
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              根据用户 id,获取信息;
 *              错误返回
 *                  {code: 1, msg: '不能修改自己的权限!'}
 *                  {code: 2, msg: '用户 id 参数缺失!'}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.get('/getperson/:id', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{
    if(ctx.params.id){
        try{
            let newUser = await User.findById(ctx.params.id, notoken);
            if(newUser){
                return ctx.ok(Message.sucess(newUser));
            }else{
                return ctx.ok(Message.error({code: 1, msg: '服务器错误!'}));
            }
        } catch (err){
            ctx.throw(err);
        }

    }else{
        return ctx.ok(Message.error({code: 2, msg: '用户 id 参数缺失!'}));
    }

});

/**
 * @swagger
 * /v1/me/getyhlist/{id}:
 *   get:
 *     operationId: getyhlist
 *     tags:
 *       - 获取详情
 *     description: 用户寻物启事列表
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: id
 *        in: path
 *        description: 用户 id,必填
 *        required: true
 *        type: string
 *      - name: postID
 *        in: query
 *        description: 启事 id
 *        required: false
 *        type: string
 *      - name: sort
 *        in: query
 *        description: 上拉加载 more ,下拉刷新 new
 *        required: false
 *        type: string
 *        enum:
 *          - more
 *          - new
 *      - name: limit
 *        in: query
 *        description: 分页 条数
 *        required: false
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              根据用户 id,获取信息;
 *              错误返回
 *                  {code: 1, msg: '不能修改自己的权限!'}
 *                  {code: 2, msg: '用户 id 参数缺失!'}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.get('/getyhlist/:id', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=>{

    if (ctx.params.id){
        let option = {type: ctx.query.type ? ctx.query.type: 0, user: ctx.params.id}, // 寻物启事
            limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
            postID = ctx.query.postID ? ctx.query.postID : null,
            sort = ctx.query.sort ? ctx.query.sort : null,
            sortStatus = -1;
        // 最新数据 大到小排列
        if (postID) {
            if (sort) {
                if (sort === "more") {
                    option._id = {$lt: postID};
                    sortStatus = -1;
                } else if (sort === "new") {
                    option._id = {$gt: postID};
                    sortStatus = 1;
                }
            }
        }

        // 1. 默认情况下,第一次加载,无 postID, sort 默认为 -1
        // 2. 有 postID sort=more,加载更多,获取比 postID 小的数据  sort 为 -1,数据方向正确,直接传给前端,直接 push 进数组
        // 3. 有 postID sort=new,获取比他更新的数据,或者说是 postID 大的数据 sort 为 1,数据方向相反,数据 reverse 传给前端,直接 shift 进数组
        try{
            let posts = await Post.find(option).sort({"_id": sortStatus}).limit(limit).populate('user', postuser);
            if (sort === "new") {
                ctx.ok(Message.sucess(posts.reverse()));
            } else {
                ctx.ok(Message.sucess(posts));
            }
        } catch (err){
            ctx.throw(err);
        }

    }else{
        return ctx.ok(Message.error({code: 2, msg: '用户 id 参数缺失!'}));
    }

});

module.exports = router;