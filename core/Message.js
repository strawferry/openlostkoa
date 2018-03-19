

/*
* API 返回消息处理;
* 数据处理正常统一使用 sucess 处理,传入要传给前端的数据 data
* 数据处理异常 统一使用 error 处理, 处理是要设定的 code 不能等于 0, 还必须要返回错误消息提示;
* */

class Message {

    static sucess(data) {
        let back = {
            code: 0,
            data: data
        };
        OUT.trace(`正确返回:\n${JSON.stringify(back)}`);
        return back;
    }


    static error(code, msg) {
        if(typeof(code) === 'number'){
            let back = {
                code: code,
                msg: msg
            };
            OUT.warn(`异常返回:\n${JSON.stringify(back)}`);
            return back;
        }else{
            OUT.warn(`异常返回:\n${JSON.stringify(code)}`);
            return code;
        }
    }

}


module.exports = Message;