'use strict';

const router = require('koa-router')();
const path = require('path');
const fs = require('fs');
const uuid = require('node-uuid');
const formidable = require('formidable');
const config = require('./../../config');
const Qiniu = require('./../../core/Qiniu');
const MiddleWare = require('./../../core/MiddleWare');
const Message = require('./../../core/Message');
const Security = require('./../../core/Security');
const jpush = require('./../../controllers/jpush/index');
const Collection = require('./../../models/collection');
const Post = require('./../../models/post');
const notoken = "_id userID userName avatar email tel createTime status role";

module.exports = router;

/**
 * @swagger
 * /v1/post/list:
 *   get:
 *     operationId: list
 *     tags:
 *       - 获取详情
 *     description: 首页列表
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
 *        description: 启事的状态 0 未结束 1 已结束, lostStatus,type,status 三者,只能其一存在
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: type
 *        in: query
 *        description: 启事类型 0 寻物启事 1 招领启事, lostStatus,type,status 三者,只能其一存在
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
 *      - name: status
 *        in: query
 *        description: 启事的审核状态, 0 待审核 1 审核通过 2 审核不通过,不显示前端,邮件通知发布者, lostStatus,type,status 三者,只能其一存在
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
 *              lostStatus 启事的状态,默认是全部状态都展示, 传入 0 为未结束 传入 1 为已结束, lostStatus,type,status 三者,只能其一存在
 *              type: 启事类型 0 寻物启事 1 招领启事, lostStatus,type,status 三者,只能其一存在
 *              status 启事的审核状态, 0 待审核 1 审核通过 2 审核不通过,不显示前端,邮件通知发布者, lostStatus,type,status 三者,只能其一存在
 *              最新数据,就是往 postId 大的,反之往 postId 小的
 *              没有数据返回空数组,自己前端判断
 *              错误返回
 *                  {code: 1, msg: "服务器错误!"}
 *              正确返回
 *                  {code: 0, data: posts}
 *            ```
 */
router.get('/list', MiddleWare.logParams, async (ctx, next) => {

    let option = {},
        limit = ctx.query.limit ? Number(ctx.query.limit) : 10,
        postID = ctx.query.postID ? ctx.query.postID : null,
        sort = ctx.query.sort ? ctx.query.sort : null,
        sortStatus = -1;

    ctx.query.lostStatus ? option.lostStatus = Number(ctx.query.lostStatus) : null;
    ctx.query.type ? option.type = Number(ctx.query.type) : null;
    ctx.query.status ? option.status = Number(ctx.query.status) : option.status = 1;
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

    try {
        let posts = await  Post.find(option).sort({"_id": sortStatus}).limit(limit).populate('user', notoken);
        if (sort === "new") {
            ctx.ok(Message.sucess(posts.reverse()));
        } else {
            ctx.ok(Message.sucess(posts));
        }
    } catch (err) {
        ctx.throw(err);
    }

});

/**
 * @swagger
 * /v1/post/detail/{id}:
 *   get:
 *     operationId: detail
 *     tags:
 *       - 获取详情
 *     description: 启事详情
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: id
 *        in: path
 *        description: 启事 id,必填
 *        required: true
 *        type: string
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              根据启事 id,获取详情;
 *              错误返回
 *                  {code: 1, msg: '服务器错误!'}
 *              正确返回
 *                  {code: 0, data: post}
 *            ```
 */
router.get('/detail/:id', MiddleWare.logParams, async (ctx, next) => {
    try {
        let post = await Post.findById(ctx.params.id).populate('user', notoken);
        if (post) {
            ctx.ok(Message.sucess(post));
        } else {
            ctx.ok(Message.error(1, "找不到该启事详情"))
        }
    } catch (err) {
        ctx.throw(err);
    }
});

/**
 * @swagger
 * /v1/post/add:
 *   post:
 *     operationId: add
 *     tags:
 *       - 发布启事
 *     description: 发布启事
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
 *          $ref: '#/definitions/PostBody'
 *     responses:
 *       200:
 *         description: >-
 *            ```
 *              设置用户信息,用户昵称,头像,手机号码;
 *               * {
 *                      title: str
 *                      desc: str
 *                      type: 0 // 0 寻物启事 1 招领启事
 *                      location: str // 捡到东西地址
 *                      date: // 捡到时间,手输入或者设置
 *                      images: // 多图数组,数组[0]为首图
 *                  }
 *              错误返回
 *                  {code: 1, msg: '不能修改自己的权限!'}
 *                  {code: 2, msg: '发布失败,服务器异常!'}
 *                  {code: 3, msg: '发布的内容必须认真填写满!'}
 *              正确返回
 *                  {code: 0, data: user}
 *            ```
 */
router.post('/add', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next) => {
    console.log(ctx.body);
    if (ctx.body.title
        && ctx.body.desc
        && ctx.body.type !== null
        && ctx.body.location
        && ctx.body.date
        && ctx.body.images && ctx.body.images.length > 0
    ) {
        let title = ctx.body.title,
            desc = ctx.body.desc,
            type = ctx.body.type,
            location = ctx.body.location,
            date = ctx.body.date,
            images = ctx.body.images,
            mainImage = images[0],
            user = ctx.user._id;

        let post = new Post({
            changeDate: Date.now(),
            title: title,
            desc: desc,
            type: type,
            location: location,
            date: date,
            images: images,
            mainImage: mainImage,
            user: user,
        });
        try {
            let apost = await post.save();
            if (apost) {
                // 通知管理员, role tags
                await jpush.tags('role', `有条新启事,需要审核:${Security.strsub(apost.title)}`, 1, {
                    type: "post",
                    post: apost._id
                });
                return ctx.ok(Message.sucess(apost));
            } else {
                return ctx.ok(Message.error({code: 2, msg: '发布失败,服务器异常!'}));
            }
        } catch (err) {
            ctx.throw(err);
        }

    } else {
        return ctx.ok(Message.error({code: 3, msg: '发布的内容必须认真填写满!'}));
    }
});


/**
 * @swagger
 * /v1/post/repost/{id}:
 *   post:
 *     operationId: repost
 *     tags:
 *       - 发布启事
 *     description: 修改启事
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: id
 *        in: path
 *        description: 原有启事 id
 *        required: true
 *        type: string
 *      - in: body
 *        name: body
 *        description: 设置用户信息,用户昵称,头像,手机号码;
 *        required: true
 *        schema:
 *          $ref: '#/definitions/PostBody'
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
router.post('/repost/:id', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next) => {
    if (ctx.params._id) {
        if (ctx.body.title
            && ctx.body.desc
            && ctx.body.type
            && ctx.body.location
            && ctx.body.date
            && ctx.body.images !== undefined && ctx.body.images.length > 0
        ) {
            let title = ctx.body.title,
                desc = ctx.body.desc,
                type = ctx.body.type,
                location = ctx.body.location,
                date = ctx.body.date,
                images = ctx.body.images,
                mainImage = images[0],
                user = ctx.user._id;
            try {
                let post = await Post.findById(ctx.params._id).populate("user", notoken);
                if (post) {
                    post.title = title;
                    post.desc = desc;
                    post.type = type;
                    post.location = location;
                    post.date = date;
                    post.images = images;
                    post.mainImage = images[0];
                    post.changeDate = Date.now();

                    let apost = await post.save();
                    if (apost) {
                        return ctx.ok(Message.sucess(apost));
                    } else {
                        return ctx.ok(Message.error({code: 2, msg: '发布失败,服务器异常!'}))
                    }
                } else {
                    return ctx.ok(Message.error({code: 5, msg: '传入的启事 id 有误!'}));
                }
            } catch (err) {
                ctx.throw(err);
            }
        } else {
            return ctx.ok(Message.error({code: 3, msg: '发布的内容必须认真填写完整!'}));
        }
    } else {
        return ctx.ok(Message.error({code: 4, msg: '必须传入原本启事的 id!'}));
    }

});


/**
 * @swagger
 * /v1/post/setstatus:
 *   get:
 *     operationId: setstatus
 *     tags:
 *       - 操作
 *     description: 更改启事审核状态
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: _id
 *        in: query
 *        description: 启事 id,必填
 *        required: true
 *        type: string
 *      - name: status
 *        in: query
 *        description: 启事审核状态 0 待审核 1 审核通过 2 审核不通过
 *        required: false
 *        type: string
 *        enum:
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
 *                  {code: 3, msg: '参数有误,必须传入你要修改的 status!'}
 *                  {code: 4, msg: '参数有误,必须传入启事 id!'}
 *                  {code: 5, msg: '您没有权限查看该数据!'}
 *              正确返回
 *                  {code: 0, data: post}
 *            ```
 */
router.get('/setstatus', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next) => {
    if (ctx.user.role > 0) {
        let id = ctx.query._id,
            status = ctx.query.status;
        if (id) {
            if (status) {
                try {
                    let post = await Post.findById(id).populate("user", notoken);
                    if (post) {
                        if (post.status == status) {
                            return ctx.ok(Message.error({code: 2, msg: '您修改的 status 不变,没有必要修改!'}));
                        } else {
                            post.status = status;
                            let npost = await post.save();
                            let alert = '您的启事已经审核通过了!';
                            if (npost.status == 2) {
                                alert = '您的启事审核不通过!';
                            }

                            await jpush.alias([String(npost.user._id)], alert, 0, {type: "post", post: npost._id})
                            return ctx.ok(Message.sucess(npost));
                        }
                    } else {
                        return ctx.ok(Message.error({code: 2, msg: '启事 id 有误!'}));
                    }

                } catch (err) {
                    ctx.throw(err);
                }
            } else {
                return ctx.ok(Message.error({code: 3, msg: '参数有误,必须传入你要修改的 status!'}));
            }
        } else {
            return ctx.ok(Message.error({code: 4, msg: '参数有误,必须传入启事 id!'}));
        }

    } else {
        return ctx.ok(Message.error({code: 5, msg: '您没有权限查看该数据!'}));
    }

});

/**
 * @swagger
 * /v1/post/setloststatus:
 *   get:
 *     operationId: setloststatus
 *     tags:
 *       - 操作
 *     description: 更改启事状态
 *     security:
 *       - token: []
 *     produces:
 *       - application/json
 *     parameters:
 *      - name: _id
 *        in: query
 *        description: 启事 id,必填
 *        required: true
 *        type: string
 *      - name: lostStatus
 *        in: query
 *        description: 启事状态 0 未结束 1 已结束
 *        required: false
 *        type: string
 *        enum:
 *          - 0
 *          - 1
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
 *                  {code: 3, msg: '参数有误,必须传入你要修改的 status!'}
 *                  {code: 4, msg: '参数有误,必须传入启事 id!'}
 *                  {code: 5, msg: '您没有权限查看该数据!'}
 *              正确返回
 *                  {code: 0, data: post}
 *            ```
 */
router.get('/setloststatus', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next) => {

    let id = ctx.query._id,
        lostStatus = ctx.query.lostStatus;

    if (id) {
        if (lostStatus) {

            try {
                let post = await Post.findById(id).populate("user", notoken);
                if (post) {
                    let req_id = String(ctx.user._id);
                    let post_id = String(post.user._id);

                    if (req_id === post_id) {

                        if (post.lostStatus == lostStatus) {
                            return ctx.ok(Message.error({code: 2, msg: '您修改的 lostStatus 不变,没有必要修改!'}));
                        } else {
                            post.lostStatus = lostStatus;
                            let npost = await post.save();
                            if (npost) {
                                let data = await Collection.find({post: npost._id}, 'user');
                                if (data) {
                                    if (data.length > 0) {
                                        await jpush.alias(filterAlais(data), `您收藏的启事状态已经发生改变,快来看吧!`, 1, {
                                            type: "post",
                                            post: npost._id
                                        });
                                    }
                                }
                                return ctx.ok(Message.sucess(npost));
                            }
                        }

                    } else if (ctx.user.role > 0) {

                        if (post.lostStatus == lostStatus) {
                            return ctx.ok(Message.error({code: 2, msg: '您修改的 lostStatus 不变,没有必要修改!'}));
                        } else {
                            post.lostStatus = lostStatus;
                            let npost = await post.save();
                            if (npost) {
                                let data = await Collection.find({post: npost._id}, 'user');
                                if (data) {
                                    if (data.length > 0) {
                                        await jpush.alias(filterAlais(data), `您收藏的启事状态已经发生改变,快来看吧!`, 1, {
                                            type: "post",
                                            post: npost._id
                                        });
                                    }
                                }
                                return ctx.ok(Message.sucess(npost));
                            }
                        }
                    } else {
                        return ctx.ok(Message.error({code: 2, msg: '您没有权限查看该数据!'}));
                    }
                } else {
                    return ctx.ok(Message.error({code: 2, msg: '启事 id 有误!'}));
                }
            } catch (err) {
                ctx.throw(err);
            }

        } else {
            return ctx.ok(Message.error({code: 2, msg: '参数有误,必须传入你要修改的 lostStatus!'}));
        }
    } else {
        return ctx.ok(Message.error({code: 2, msg: '参数有误,必须传入启事 id!'}));
    }
});

function filterAlais(data) {
    let temp = [];
    for (let i = 0; i < data.length; i++) {
        let dd = data[i];
        temp.push(String(dd.user));
    }
    return temp;
}

// /**
//  * @swagger
//  * /v1/post/uploadFile:
//  *   post:
//  *     operationId: uploadFile
//  *     tags:
//  *       - 发布启事
//  *     description: 上传图片文件等
//  *     security:
//  *       - token: []
//  *     consumes:
//  *       - multipart/form-data
//  *     produces:
//  *       - application/json
//  *     parameters:
//  *       - name: file
//  *         in: formData
//  *         description: file to upload
//  *         required: false
//  *         type: file
//  *       - name: files
//  *         in: formData
//  *         description: Additional data to pass to server
//  *         required: true
//  *         type: string
//  *
//  *
//  *     responses:
//  *       200:
//  *         description: >-
//  *            ```
//  *              设置用户信息,用户昵称,头像,手机号码;
//  *              错误返回
//  *                  {code: 1, msg: '不能修改自己的权限!'}
//  *                  {code: 2, msg: '图片大小超过3M,请选取其他图片!'}
//  *                  {code: 3, msg: "请先选择图片!"}
//  *              正确返回
//  *                  {code: 0, data: result}
//  *            ```
//  */
// router.post('/uploadFile', MiddleWare.logParams, MiddleWare.checkToken(), async (ctx, next)=> {
//     // 目前文件上传服务器 koa 还没解决 😭
//     setTimeout(()=>{
//         return ctx.ok(Message.sucess('https://unsplash.it/800/600?random'))
//     }, 2500);
// });