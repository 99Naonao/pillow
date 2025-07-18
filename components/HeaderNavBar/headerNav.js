/**
 * 头部自定义导航栏
 * 
 * 参数：
 * show: 显示导航标题栏，默认显示
 * title: 导航栏标题
 * bgColor: 导航栏背景颜色，默认透明'transparent'
 * noSticky: 取消导航栏粘性布局(不占头部导航栏位置)，默认不取消
 * opacity: 导航栏透明度，默认1不透明
 * showNavBtn: 是否显示左侧导航按钮，默认true显示
 * navIcon: 用户自定义导航按钮图标路径
 * navHome: 导航按钮为主页home，与返回back互斥，默认false显示返回back
 * 
 * 外部样式类：(使用时注意权重，添加外部样式类无效果的时候，给类加点权重就可以了)
 * custom-icon-class: 标题左侧图标外部样式类
 * custom-title-class: 标题外部样式类
 * custom-root-class: 根节点外部样式类
 * 
 * 事件：
 * onBack: 用户点击左上角返回按钮后回调
 * onHome: 用户点击左上角Home按钮后回调
 * onIcon: 用户点击自定义icon后回调
 * 
 * 使用：在页面的json文件中
 * "usingComponents": {
 *    "header-nav-bar": "/components/HeadNavBar/HeadNavBar"
 * },
 */

const app = getApp()
Component({
  // 外部样式类
  externalClasses: ['custom-icon-class', 'custom-title-class', 'custom-root-class'],
  // 组件的属性列表
  properties: {
    show: {
      type: Boolean,
      value: true
    },
    title: {
      type: String,
      value: '标题'
    },
    titleColor: {
      type:String,
      value:'rgba(0,0,0,1)'
    },
    bgColor: {
      type: String,
      value: 'transparent'
    },
    noSticky: {
      type: Boolean,
      value: false
    },
    opacity: {
      type: Number,
      value: 1
    },
    showNavBtn: {
      type: Boolean,
      value: true
    },
    navIcon: {
      type: String,
      value: ''
    },
    navHome: {
      type: Boolean,
      value: false
    },
  },
  options: {
    // 在组件定义时的选项中启用多 slot 支持
    multipleSlots: true // 复数插槽: 是
  },
  // 组件的初始数据
  data: {
    // 导航栏数据
    navHeight: 0,
    remainHeight: 0,
    navTop: 0
  },
  // 生命周期函数推荐写法
  lifetimes: {
    // 生命周期函数，可以为函数，或一个在methods段中定义的方法名
    // 在组件实例进入页面节点树时执行
    attached: function () {
      // 设置导航栏，获取菜单按钮的布局位置信息
      let menuButtonObject = wx.getMenuButtonBoundingClientRect()
      // 获取系统信息
      wx.getSystemInfo({
        success: (res) => {
          // console.log(res);
          // 状态栏的高度
          let statusBarHeight = res.statusBarHeight
          // 胶囊按钮与顶部的距离
          let navTop = menuButtonObject.top
          // 导航栏高度
          let navHeight = statusBarHeight + menuButtonObject.height + (menuButtonObject.top - statusBarHeight) * 2
          // 除导航栏剩余高度
          let remainHeight = res.windowHeight - navHeight
          // 设置录入数据属性
          this.setData({
            navHeight: navHeight, // 导航栏高度
            remainHeight: remainHeight, // 除导航栏剩余高度
            navTop: navTop // 胶囊按钮与顶部的距离
          })
          // 子传父，将导航栏高度传过去
          /* this.triggerEvent('getNavHeight', {
              navHeight: this.data.navHeight
          }) */
          // 将导航栏高度设置进全局数据
          app.globalData.navHeight = navHeight
          // 将除导航栏剩余高度设置进全局数据
          app.globalData.remainHeight = remainHeight
        },
        fail(err) {
          console.log(err)
        }
      })
    },
    // 在组件实例被从页面节点树移除时执行
    detached: function () {}
  },
  // 组件的方法列表
  methods: {
    // 回退
    navBack() {
      wx.navigateBack()
      this.triggerEvent('onBack')
    },
    // 回主页
    navHome() {
      wx.switchTab({
        url: '/src/pages/home/home'
      })
      this.triggerEvent('onHome')
    },
    navIcon() {
      this.triggerEvent('onIcon')
    }
  },
})