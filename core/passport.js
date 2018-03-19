'use strict';

const passport = require('koa-passport');
const LocalStrategy = require('passport-local').Strategy;

exports.setup = function (User) {
  passport.use(new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password' // this is the virtual field on the model
    },
    async (email, password, done) => {
      try {
        console.log(email);
        console.log(password);
        const user = await User.findOne({email: email})
        if (!user) {
          OUT.error('登录用户名错误',{'username':email})
          return done(null, false, { error_msg: '用户名或密码错误.' })
        }
        if (!user.comparePassword(password)) {
            OUT.error('登录密码错误',{'username':email})
          return done(null, false, { error_msg: '用户名或密码错误.' })
        }
        user.password = '';
        return done(null, user)        
      } catch (err) {
        OUT.error('LocalStrategy error');
        return done(err) 
      }
    }
  ))
};