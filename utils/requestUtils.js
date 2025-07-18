// 配置项：需用户根据实际项目配置
const baseConfig = {
  publicAppId: "wx1a89a54eb7b69130", // 应用唯一标识
  baseUrl: "https://sleep.zsyl.cc/api", // 后端接口基础地址
  api: {
    wxLogin: "/ybLoginWx" // 登录接口路径
  }
};

/**
 * 自动登录入口函数
 * @param {Function} callback 登录成功后的回调函数
 */
export function autoLogin(callback) {
  // 调用获取登录凭证code的方法
  onGetCode()
    .then((code) => {
      if (!code) {
        throw new Error("获取code失败");
      }
      console.log("获取code成功:", code);
      // 组装登录请求参数
      const loginData = {
        code: code, // 登录凭证
        appId: baseConfig.publicAppId, // 应用ID
        userName: code // 临时使用code作为用户名
      };
      // 调用后端登录接口
      return wxLogin(loginData);
    })
    .then((userInfo) => {
      if (!userInfo) {
        throw new Error("登录接口返回用户信息为空");
      }
      // 存储用户信息（如本地存储）
      setUserInfo(userInfo);
      // 显示登录成功提示
      wx.showToast({
        title: "登录成功",
        icon: "success",
        duration: 2000,
        success() {
          // 登录成功后执行回调
          if (typeof callback === "function") {
            callback();
          }
        }
      });
    })
    .catch((err) => {
      // 捕获整个登录流程中的错误并提示
      console.error("自动登录失败:", err);
      wx.showToast({
        title: err.message || "登录失败，请重试",
        icon: "none",
        duration: 2000
      });
    });
}

/**
 * 获取微信登录凭证（code）
 * @returns {Promise<string>} 登录凭证code
 */
export function onGetCode() {
  return new Promise((resolve, reject) => {
    try {
      // 微信原生登录接口：获取code
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            reject(new Error("登录凭证code为空"));
            return;
          }
          // 成功获取code，返回给调用方
          resolve(loginRes.code);
        },
        fail: (err) => {
          // 登录接口调用失败（如网络问题）
          reject(new Error(`获取code失败：${err.errMsg}`));
        }
      });
    } catch (err) {
      // 捕获函数执行中的异常（如API调用错误）
      reject(new Error(`onGetCode执行异常：${err.message}`));
    }
  });
}

/**
 * 调用后端微信登录接口
 * @param {Object} data 登录请求参数（包含code、appId等）
 * @returns {Promise<Object>} 后端返回的用户信息
 */
export function wxLogin(data) {
  if (!data || !data.code || !data.appId) {
    return Promise.reject(new Error("登录参数不完整（缺少code或appId）"));
  }
  // 拼接完整登录接口地址
  const loginUrl = baseConfig.baseUrl + baseConfig.api.wxLogin;
  // 调用封装的网络请求函数
  return request_(loginUrl, data);
}

/**
 * 网络请求封装（基于微信原生wx.request）
 * @param {string} url 接口地址
 * @param {Object} data 请求参数
 * @returns {Promise<Object>} 接口返回的业务数据
 */
function request_(url, data) {
  return new Promise((resolve, reject) => {
    // 容错：检查url合法性
    if (!url || typeof url !== "string") {
      reject(new Error("请求地址不合法"));
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: "加载中",
      mask: true // 防止用户误操作
    });

    // 从本地存储获取用户信息
    let storedUserInfo = {};
    try {
      storedUserInfo = wx.getStorageSync("userInfo") || {};
    } catch (err) {
      console.warn("获取本地存储用户信息失败（不影响本次请求）：", err);
    }

    // 组装请求头
    const header = {
      "Content-Type": "application/json;charset=UTF-8"
      // 如需携带token，可在此处添加
      // "Authorization": storedUserInfo.token ? `Bearer ${storedUserInfo.token}` : ""
    };

    // 微信原生网络请求
    wx.request({
      url: url,
      method: "POST",
      data: data,
      header: header,
      success: (res) => {
        // 隐藏加载提示
        wx.hideLoading();

        // 容错：检查响应状态
        if (res.statusCode !== 200) {
          reject(new Error(`接口请求失败（HTTP状态码：${res.statusCode}）`));
          return;
        }

        // 解析响应数据
        const { code, data: resData, message } = res.data || {};

        // 处理特定业务状态码（根据后端实际定义调整）
        if ([601, 40098].includes(code)) {
          // 特殊状态码：直接返回状态码
          resolve(code);
        } else if (code === 200) {
          // 成功状态码：返回业务数据
          if (resData === undefined) {
            reject(new Error("接口返回数据为空"));
          } else {
            resolve(resData);
          }
        } else {
          // 其他异常状态码：返回错误信息
          reject(new Error(`业务错误：${message || "未知错误"}（code: ${code}）`));
        }
      },
      fail: (err) => {
        // 隐藏加载提示
        wx.hideLoading();
        // 网络请求失败（如断网、超时等）
        reject(new Error(`请求发送失败：${err.errMsg}`));
      }
    });
  });
}

/**
 * 存储用户信息到本地（封装本地存储逻辑）
 * @param {Object} userInfo 需存储的用户信息
 */
function setUserInfo(userInfo) {
  if (!userInfo) {
    console.warn("存储用户信息失败：信息为空");
    return;
  }
  try {
    wx.setStorageSync("userInfo", userInfo);
    console.log("用户信息已成功存储到本地");
  } catch (err) {
    console.error("存储用户信息到本地失败：", err);
  }
}