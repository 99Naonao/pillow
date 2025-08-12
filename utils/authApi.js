/**
 * 认证API工具类 - 处理登录注册相关接口
 */
const BASE_URL = 'https://zhongshu.xinglu.shop';

class AuthApi {
  /**
   * 发送验证码（注册）
   * @param {string} mobile 手機號
   * @param {string} version 版本號（可選）
   * @returns {Promise} 請求結果
   */
  static sendRegisterCaptcha(mobile, version = '1') {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/shopapi/register/captcha`,
        method: 'POST',
        header: {
          'content-type': 'application/json',
          'version': version,
          'terminal': '7'
        },
        data: {
          mobile: mobile
        },
        success: (res) => {
          console.log('发送注册验证码成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('发送注册验证码失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 用户注册
   * @param {Object} params 注册参数
   * @param {string} params.register_source 注册来源
   * @param {string} params.mobile 手机号
   * @param {string} params.code 验证码
   * @param {string} params.password 密码
   * @param {string} params.password_confirm 确认密码
   * @param {string} version 版本号（可选）
   * @returns {Promise} 请求结果
   */
  static register(params, version = '1') {
    console.log('注册参数:::',params)
    return new Promise((resolve, reject) => {
      // const formData = {
      //   register_source: params.register_source,
      //   mobile: params.mobile,
      //   code: params.code,
      //   password: params.password,
      //   password_confirm: params.password_confirm
      // };
      wx.request({
        url: `${BASE_URL}/shopapi/register/register`,
        method: 'POST',
        header: {
          'content-type': 'application/json',
          'version': version,
          'terminal': '7'
        },
        data: {
          register_source: params.register_source,
          mobile: params.mobile,
          code: params.code,
          password: params.password,
          password_confirm: params.password_confirm
        },
        success: (res) => {
          console.log('注册成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('注册失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 发送验证码（登录）
   * @param {string} mobile 手机号
   * @param {string} version 版本号（可选）
   * @returns {Promise} 请求结果
   */
  static sendLoginCaptcha(mobile, version = '1') {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/shopapi/login/captcha`,
        method: 'POST',
        header: {
          'content-type': 'application/json',
          'version': version,
          'terminal': '7'
        },
        data: {
          mobile: mobile
        },
        success: (res) => {
          console.log('发送登录验证码成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('发送登录验证码失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 用户登录
   * @param {Object} params 登录参数
   * @param {string} params.account 账号（手机号）
   * @param {string} params.password 密码（场景1必填）
   * @param {string} params.code 验证码（场景2必填）
   * @param {string} params.scene 登录场景 "1"-手机号密码登录 "2"-手机号验证码登录
   * @param {string} version 版本号（可选）
   * @returns {Promise} 请求结果
   */
  static login(params, version = '1') {
    console.log('login接口传进来的params:',params)
    return new Promise((resolve, reject) => {
      const requestData = {
        terminal:params.terminal,
        scene:params.scene,
        account: params.account
      };

      if (params.scene === "1") {
        requestData.password = params.password;
      } else if (params.scene === "2") {
        requestData.code = params.code;
      }
      
      const headers = {
        'content-type': 'application/json',
        'version': version,
        'terminal': '7',
        'scene': params.scene
      };
      
      console.log('登录请求参数:',requestData)
      console.log('登录请求headers:',headers)
      
      wx.request({
        url: `${BASE_URL}/shopapi/login/account`,
        method: 'POST',
        header: headers,
        data: requestData,
        success: (res) => {
          console.log('登录成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('登录失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 保存用户信息到本地
   * @param {Object} userInfo 用户信息
   */
  static saveUserInfo(userInfo) {
    try {
      // 处理用户信息，确保有默认值
      const processedUserInfo = {
        ...userInfo,
        avatar: userInfo.avatar || '/static/default_avatar.png',
        nickname: userInfo.nickname || userInfo.account || '用户',
        account: userInfo.account || userInfo.nickname || '用户'
      };
      
      wx.setStorageSync('userInfo', processedUserInfo);
      wx.setStorageSync('token', userInfo.token);
      console.log('用户信息已保存到本地:', processedUserInfo);
      console.log('Token已保存:', userInfo.token);
    } catch (error) {
      console.error('保存用户信息失败:', error);
    }
  }

  /**
   * 获取本地用户信息
   * @returns {Object|null} 用户信息
   */
  static getUserInfo() {
    try {
      return wx.getStorageSync('userInfo') || null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 获取本地token
   * @returns {string|null} token
   */
  static getToken() {
    try {
      return wx.getStorageSync('token') || null;
    } catch (error) {
      console.error('获取token失败:', error);
      return null;
    }
  }

  /**
   * 清除本地用户信息
   */
  static clearUserInfo() {
    try {
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('token');
      console.log('用户信息已清除');
    } catch (error) {
      console.error('清除用户信息失败:', error);
    }
  }

  /**
   * 检查是否已登录
   * @returns {boolean} 是否已登录
   */
  static isLoggedIn() {
    const userInfo = this.getUserInfo();
    const token = this.getToken();
    return !!(userInfo && token);
  }

  /**
   * 更新用户信息到服务器
   * @param {Object} userInfo 用户信息
   * @param {string} userInfo.avatar 头像URL
   * @param {string} userInfo.nickname 昵称
   * @returns {Promise} 请求结果
   */
  static updateUserInfo(userInfo) {
    return new Promise((resolve, reject) => {
      const token = this.getToken();
      if (!token) {
        reject(new Error('未登录'));
        return;
      }

      wx.request({
        url: `${BASE_URL}/shopapi/user/update`,
        method: 'POST',
        header: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          avatar: userInfo.avatar,
          nickname: userInfo.nickname
        },
        success: (res) => {
          console.log('更新用户信息成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('更新用户信息失败:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * 上传头像
   * @param {string} filePath 文件路径
   * @returns {Promise} 请求结果
   */
  static uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      const token = this.getToken();
      if (!token) {
        reject(new Error('未登录'));
        return;
      }

      wx.uploadFile({
        url: `${BASE_URL}/shopapi/user/upload-avatar`,
        filePath: filePath,
        name: 'avatar',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          console.log('上传头像成功:', res);
          try {
            const data = JSON.parse(res.data);
            resolve(data);
          } catch (error) {
            reject(new Error('解析响应失败'));
          }
        },
        fail: (error) => {
          console.error('上传头像失败:', error);
          reject(error);
        }
      });
    });
  }
}

module.exports = AuthApi; 