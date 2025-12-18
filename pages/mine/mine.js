// pages/mine/mine.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const CommonUtil = require('../../utils/commonUtil');
const HealthConfig = require('../../utils/healthConfig');
const EnvUtil = require('../../utils/envUtil');
const BluetoothManager = require('../../utils/bluetoothManager');
const AccountManager = require('../../utils/accountManager');
Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		isLogin: false, // true为已登录，false为未登录
		avatarUrl: '',
		userName: '',
		// 编辑相关
		showAvatarModal: false,
		showNicknameModal: false,
		nicknameInput: '',
		// 新的头像昵称获取相关
		showNewAvatarModal: false,
		tempUserInfo: {
			avatarUrl: '',
			nickName: ''
		},
		// 告警相关
		alarmEnabled: false,
		emergencyContacts: [], // 紧急联系人列表
		showContactModal: false, // 联系人管理弹窗
		showAddContactModal: false, // 添加联系人弹窗
		phoneInput: '',
		// 呼吸监测相关
		breathRate: 0,
		breathThreshold: 10, // 呼吸频率阈值
		breathLowCount: 0, // 连续低呼吸次数
		breathLowLimit: 12, // 连续低呼吸限制
		// 心率监测相关
		heartRate: 0,
		heartThreshold: 40, // 心率阈值（低）
		heartHighThreshold: 80, // 心率阈值（高）
		heartLowCount: 0, // 连续心率异常次数
		heartHighCount: 0, // 连续心率异常次数
		heartLowLimit: 12, // 连续心率异常限制
		alarmed: false, // 是否已告警
		// 协议查看相关
		showProtocolViewer: false,
		currentProtocolType: 'service',
		// 协议卡片展开状态
		protocolExpanded: false,
		// 开发环境相关
		showTestPages: false,
		EquipmentNumb: [],
		PonseNumb:{},
		accountCount: 0,
		// 重置密码相关
		showResetPasswordModal: false,
		resetPasswordForm: {
			mobile: '',
			code: '',
			password: ''
		},
		resetPasswordCountdown: 0,
		resetPasswordTimer: null
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad(options) {
		// 初始化设备管理器
		this.deviceManager = new DeviceManager(this);

		// 判断是否为开发环境
		const isDev = EnvUtil.isDev();
		this.setData({
			showTestPages: isDev
		});

		if (isDev) {
			console.log('开发环境：显示测试页面入口');
		}

		this.loadAlarmSettings();

		// 調試：打印接收到的參數
		console.log('個人中心頁面接收到的參數:', options);
		console.log('tab參數值:', options.tab);

		// 檢查是否有tab參數，如果有則直接打開對應的彈窗
		if (options.tab === 'emergency') {
			console.log('檢測到emergency參數，準備打開緊急聯繫人彈窗');
			// 延遲一點時間確保頁面完全加載
			setTimeout(() => {
				console.log('開始調用openContactModal方法');
				this.openContactModal();
			}, 500);
		} else {
			console.log('沒有檢測到emergency參數，不打開彈窗');
		}
	},

	/**
	 * 生命周期函数--监听页面显示
	 */
	onShow() {
		// 获取本地用户信息
		const userInfo = wx.getStorageSync('userInfo');
		const token = wx.getStorageSync('token');


		// 先加载告警设置
		this.loadAlarmSettings();
		this.loadDevices();
		this.loadAccounts();
		if (userInfo && token) {
			// 使用API返回的用户信息，用户名显示为手机号，头像使用默认头像
			this.setData({
				isLogin: true,
				avatarUrl: userInfo.avatar || '/static/default_avatar.png',
				userName: userInfo.account || userInfo.nickname || '用户'
			});

			// 检查是否需要更新告警状态
			const hasContacts = this.data.emergencyContacts && this.data.emergencyContacts.length > 0;
			const shouldEnableAlarm = hasContacts;

			// 只在状态需要改变时才更新并保存
			if (this.data.alarmEnabled !== shouldEnableAlarm) {
				if (shouldEnableAlarm) {
					console.log('用户已登录且有紧急联系人设置，自动开启告警功能');
					this.setData({
						alarmEnabled: true
					});
					this.saveAlarmSettings();
					// 启动呼吸监测
					this.startBreathMonitor();
				} else {
					console.log('用户已登录但未设置紧急联系人，自动关闭告警功能');
					this.setData({
						alarmEnabled: false
					});
					this.saveAlarmSettings();
				}
			} else if (shouldEnableAlarm) {
				// 状态不需要改变，但如果告警已启用，确保监测已启动
				this.startBreathMonitor();
			}
		} else {
			this.setData({
				isLogin: false,
				avatarUrl: '',
				userName: '',
				accountCount: 0
			});

			// 如果告警已启用但用户未登录，自动关闭告警
			if (this.data.alarmEnabled) {
				console.log('用户未登录，自动关闭告警功能');
				this.setData({
					alarmEnabled: false,
					alarmed: false,
					breathLowCount: 0,
					heartLowCount: 0,
					heartHighCount: 0
				});
				this.saveAlarmSettings();
			}
		}
	},

	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide() {
		this.stopBreathMonitor();
	},

	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload() {
		this.stopBreathMonitor();
		// 清理重置密码定时器
		if (this.data.resetPasswordTimer) {
			clearInterval(this.data.resetPasswordTimer);
			this.setData({
				resetPasswordTimer: null
			});
		}
	},


	async loadDevices(showToast = false, options = {}) {


		try {
			const response = await BluetoothManager.GetEquipmentLists(1, 15);
			const responseT = await BluetoothManager.GetFastUserList(1, 15);
			this.setData({
				EquipmentNumb: response.data,
				PonseNumb: responseT.data,
			});
		} catch (error) {
			console.error('加载设备列表失败:', error);
		} finally {}
	},

	loadAccounts() {
		try {
			if (!AuthApi.isLoggedIn()) {
				this.setData({
					accountCount: 0
				});
				return;
			}
			const accounts = AccountManager.getAccountList();
			this.setData({
				accountCount: accounts.length
			});
		} catch (error) {
			console.error('加载账号列表失败:', error);
		}
	},

	/**
	 * 加载告警设置
	 */
	loadAlarmSettings() {
		try {
			const alarmSettings = wx.getStorageSync('alarmSettings') || {};
			this.setData({
				alarmEnabled: alarmSettings.enabled || false,
				emergencyContacts: alarmSettings.contacts || [],
				breathThreshold: alarmSettings.breathThreshold || 10,
				breathLowLimit: alarmSettings.breathLowLimit || 12,
				heartThreshold: alarmSettings.heartThreshold || 50,
				heartHighThreshold: alarmSettings.heartHighThreshold || 120,
				heartLowLimit: alarmSettings.heartLowLimit || 12
			});
			console.log('加载告警设置:', alarmSettings);
		} catch (error) {
			console.error('加载告警设置失败:', error);
		}
	},

	/**
	 * 保存告警设置
	 */
	saveAlarmSettings() {
		try {
			const alarmSettings = {
				enabled: this.data.alarmEnabled,
				contacts: this.data.emergencyContacts,
				breathThreshold: this.data.breathThreshold,
				breathLowLimit: this.data.breathLowLimit,
				heartThreshold: this.data.heartThreshold,
				heartHighThreshold: this.data.heartHighThreshold,
				heartLowLimit: this.data.heartLowLimit
			};
			wx.setStorageSync('alarmSettings', alarmSettings);
			console.log('保存告警设置:', alarmSettings);

			// 同步到HealthConfig
			this.syncToHealthConfig();
		} catch (error) {
			console.error('保存告警设置失败:', error);
		}
	},

	/**
	 * 同步到HealthConfig并调用API
	 */
	syncToHealthConfig() {
		try {
			// 获取现有的健康配置
			const configData = wx.getStorageSync('healthConfig') || {};
			const config = new HealthConfig(configData);

			// 更新phone_list
			const newPhoneList = [...this.data.emergencyContacts];
			const oldPhoneList = config.phoneList || [];

			// 检查phone_list是否真的发生了变化
			const phoneListChanged = JSON.stringify(newPhoneList.sort()) !== JSON.stringify(oldPhoneList
		.sort());

			// 更新phone_list
			config.phoneList = newPhoneList;

			// 获取更新后的配置
			const newConfig = config.getAllConfig();

			// 检查配置是否真的发生了变化（比较关键字段）
			const oldConfigStr = JSON.stringify({
				phone_list: oldPhoneList,
				is_hr_message: configData.is_hr_message,
				is_hr_voice: configData.is_hr_voice,
				hr_too_fast: configData.hr_too_fast,
				hr_too_slow: configData.hr_too_slow,
				is_br_message: configData.is_br_message,
				is_br_voice: configData.is_br_voice,
				br_too_fast: configData.br_too_fast,
				br_too_slow: configData.br_too_slow,
				is_outbed_message: configData.is_outbed_message,
				is_outbed_voice: configData.is_outbed_voice,
				outbed_exceed: configData.outbed_exceed,
				outbed_start_time: configData.outbed_start_time,
				outbed_end_time: configData.outbed_end_time,
				is_sos_message: configData.is_sos_message,
				is_sos_voice: configData.is_sos_voice,
				is_apnea_message: configData.is_apnea_message,
				is_apnea_voice: configData.is_apnea_voice
			});

			const newConfigStr = JSON.stringify({
				phone_list: newPhoneList,
				is_hr_message: newConfig.is_hr_message,
				is_hr_voice: newConfig.is_hr_voice,
				hr_too_fast: newConfig.hr_too_fast,
				hr_too_slow: newConfig.hr_too_slow,
				is_br_message: newConfig.is_br_message,
				is_br_voice: newConfig.is_br_voice,
				br_too_fast: newConfig.br_too_fast,
				br_too_slow: newConfig.br_too_slow,
				is_outbed_message: newConfig.is_outbed_message,
				is_outbed_voice: newConfig.is_outbed_voice,
				outbed_exceed: newConfig.outbed_exceed,
				outbed_start_time: newConfig.outbed_start_time,
				outbed_end_time: newConfig.outbed_end_time,
				is_sos_message: newConfig.is_sos_message,
				is_sos_voice: newConfig.is_sos_voice,
				is_apnea_message: newConfig.is_apnea_message,
				is_apnea_voice: newConfig.is_apnea_voice
			});

			const configChanged = oldConfigStr !== newConfigStr;

			// 保存更新后的配置
			wx.setStorageSync('healthConfig', newConfig);

			// 只在配置真正发生变化时才调用API
			if (configChanged && this.deviceManager) {
				console.log('检测到配置变化，调用API设置设备预警');
				this.deviceManager.setDeviceWarningSetting(config)
					.then(res => {
						console.log('设备预警设置成功:', res);
					})
					.catch(err => {
						console.error('设备预警设置失败:', err);
					});
			} else {
				console.log('配置未发生变化，跳过API调用');
			}
		} catch (error) {
			console.error('同步到HealthConfig失败:', error);
		}
	},

	goLogin() {
		console.log('点击登录按钮');
		// wx.navigateTo({
		//   url: '/page_subject/login/login',
		// })
		wx.navigateTo({
			url: '/page_subject/welcome/welcome'
		});
	},

	goRingSet() {
		console.log("点击预警设置");
		wx.navigateTo({
			url: '/page_subject/ring/ring',
		})
	},

	/**
	 * 跳转到设备列表页面
	 */
	goDeviceManagement() {
		if (!AuthApi.isLoggedIn()) {
			wx.showToast({
				title: '请先登录',
				icon: 'none'
			});
			return;
		}
		wx.navigateTo({
			url: '/page_subject/device_list/device_list'
		});
	},

	goAccountManagement() {
		if (!AuthApi.isLoggedIn()) {
			wx.showToast({
				title: '请先登录',
				icon: 'none'
			});
			return;
		}
		wx.navigateTo({
			url: '/page_subject/account_list/account_list'
		});
	},


	/**
	 * 打开联系人管理弹窗
	 */
	openContactModal() {
		console.log('openContactModal方法被調用');
		console.log('當前登錄狀態:', AuthApi.isLoggedIn());

		// 检查用户是否已登录
		if (!AuthApi.isLoggedIn()) {
			console.log('用户未登录，弹出登录提示');
			wx.showModal({
				title: '请先登录',
				content: '您需要先登录才能设置紧急联系人，是否前往登录页面？',
				confirmText: '去登录',
				cancelText: '取消',
				success: (res) => {
					if (res.confirm) {
						// 跳转到登录页面
						// wx.navigateTo({
						//   url: '/page_subject/login/login'
						// });
						wx.navigateTo({
							url: '/page_subject/welcome/welcome'
						});
					}
				}
			});
			return;
		}

		console.log('用戶已登錄，準備打開緊急聯繫人彈窗');
		this.setData({
			showContactModal: true
		});
		console.log('緊急聯繫人彈窗狀態已設置為true');
	},

	/**
	 * 关闭联系人管理弹窗
	 */
	closeContactModal() {
		this.setData({
			showContactModal: false
		});

		// 如果有紧急联系人，自动开启告警功能
		if (this.data.emergencyContacts && this.data.emergencyContacts.length > 0) {
			this.setData({
				alarmEnabled: true
			});
			this.saveAlarmSettings();
			this.startBreathMonitor();
		} else {
			this.setData({
				alarmEnabled: false
			});
			this.saveAlarmSettings();
			this.stopBreathMonitor();
		}
	},

	/**
	 * 添加联系人
	 */
	addContact() {
		this.setData({
			showAddContactModal: true,
			phoneInput: ''
		});
	},

	/**
	 * 关闭添加联系人弹窗
	 */
	onAddContactCancel() {
		this.setData({
			showAddContactModal: false,
			phoneInput: ''
		});
	},

	/**
	 * 手机号输入
	 */
	onPhoneInput(e) {
		this.setData({
			phoneInput: e.detail.value
		});
	},

	/**
	 * 确认添加联系人
	 */
	onAddContactConfirm() {
		const phone = this.data.phoneInput.trim();

		// 手机号格式验证
		if (!phone) {
			wx.showToast({
				title: '请输入手机号',
				icon: 'none'
			});
			return;
		}

		if (!CommonUtil.isValidChinesePhone(phone)) {
			wx.showModal({
				title: '提示',
				content: '请检查输入的手机号是否有误',
				showCancel: false,
				confirmText: '确定'
			});
			return;
		}

		// 检查是否已存在
		if (this.data.emergencyContacts.includes(phone)) {
			wx.showToast({
				title: '该手机号已存在',
				icon: 'none'
			});
			return;
		}

		// 添加联系人
		const newContacts = [...this.data.emergencyContacts, phone];
		this.setData({
			emergencyContacts: newContacts,
			showAddContactModal: false,
			phoneInput: ''
		});

		// 保存设置
		this.saveAlarmSettings();

		wx.showToast({
			title: '添加成功',
			icon: 'success'
		});
	},

	/**
	 * 删除联系人
	 */
	deleteContact(e) {
		const index = e.currentTarget.dataset.index;
		const contacts = [...this.data.emergencyContacts];
		contacts.splice(index, 1);

		this.setData({
			emergencyContacts: contacts
		});

		// 保存设置
		this.saveAlarmSettings();

		wx.showToast({
			title: '删除成功',
			icon: 'success'
		});
	},

	/**
	 * 启动呼吸监测
	 */
	startBreathMonitor() {
		// 检查用户是否已登录
		if (!AuthApi.isLoggedIn()) {
			console.log('用户未登录，无法启动呼吸监测');
			return;
		}

		if (this.breathTimer) {
			clearInterval(this.breathTimer);
		}

		console.log('启动呼吸监测');
		this.breathTimer = setInterval(() => {
			this.checkBreathRate();
		}, 60000); // 每分钟检查一次
	},

	/**
	 * 停止呼吸监测
	 */
	stopBreathMonitor() {
		if (this.breathTimer) {
			clearInterval(this.breathTimer);
			this.breathTimer = null;
			console.log('停止呼吸监测');
		}
	},

	/**
	 * 检查呼吸频率和心率
	 */
	checkBreathRate() {
		// 获取设备实时数据
		const commonUtil = require('../../utils/commonUtil');
		const wifiMac = commonUtil.getSavedWifiMac();

		if (!wifiMac) {
			console.log('没有保存的WiFi MAC地址');
			return;
		}

		console.log('当前WiFi MAC地址:', wifiMac);

		if (!this.deviceManager) {
			console.error('deviceManager未初始化');
			return;
		}

		const promise = this.deviceManager.getDeviceRealtimeData(wifiMac);
		if (!promise || typeof promise.then !== 'function') {
			console.error('[mine] getDeviceRealtimeData 未返回 Promise');
			return;
		}
		
		promise.then(result => {
			if (result && result.ret === 0 && result.data && result.data.length > 0) {
				const deviceData = result.data[0];
				let breathRate = null;
				let heartRate = null;

        // 判断 left 数据是否完整有效（heart_rate 和 respiration_rate 都不为 0）
        const isLeftValid = deviceData.left && 
                            deviceData.left.heart_rate && deviceData.left.heart_rate !== 0 && 
                            deviceData.left.respiration_rate && deviceData.left.respiration_rate !== 0;
        
        // 判断 right 数据是否完整有效（heart_rate 和 respiration_rate 都不为 0）
        const isRightValid = deviceData.right && 
                             deviceData.right.heart_rate && deviceData.right.heart_rate !== 0 && 
                             deviceData.right.respiration_rate && deviceData.right.respiration_rate !== 0;
        
        // 优先使用 left，如果 left 无效则使用 right
        if (isLeftValid) {
          // 使用 left 的所有数据
          heartRate = deviceData.left.heart_rate;
          breathRate = deviceData.left.respiration_rate;
        } else if (isRightValid) {
          // 使用 right 的所有数据
          heartRate = deviceData.right.heart_rate;
          breathRate = deviceData.right.respiration_rate;
        }

				// 检查呼吸频率
				if (breathRate !== null) {
					console.log('检查呼吸频率:', breathRate, '阈值:', this.data.breathThreshold);

					if (breathRate < this.data.breathThreshold) {
						const newCount = this.data.breathLowCount + 1;
						this.setData({
							breathLowCount: newCount
						});
						console.log('呼吸频率过低，连续次数:', newCount, '限制:', this.data.breathLowLimit);

						if (newCount >= this.data.breathLowLimit && !this.data.alarmed) {
							console.log('呼吸频率连续异常达到限制，触发语音告警');
							this.setData({
								alarmed: true
							});
							this.triggerVoiceAlarm(1); // 1呼吸异常
						}
					} else {
						this.setData({
							breathLowCount: 0
						});
						console.log('呼吸频率正常，重置异常计数');
					}
				}

				// 检查心率
				if (heartRate !== null) {
					console.log('检查心率:', heartRate, '低阈值:', this.data.heartThreshold, '高阈值:', this.data
						.heartHighThreshold);

					if (heartRate < this.data.heartThreshold) {
						const newCount = this.data.heartLowCount + 1;
						this.setData({
							heartLowCount: newCount
						});
						console.log('心率过低，连续次数:', newCount, '限制:', this.data.heartLowLimit);

						if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
							console.log('心率过低连续异常达到限制，触发语音告警');
							this.setData({
								alarmed: true
							});
							this.triggerVoiceAlarm(2); // 2心率异常
						}
					} else if (heartRate > this.data.heartHighThreshold) {
						const newCount = this.data.heartHighCount + 1;
						this.setData({
							heartHighCount: newCount
						});
						console.log('心率过高，连续次数:', newCount, '限制:', this.data.heartLowLimit);

						if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
							console.log('心率过高连续异常达到限制，触发语音告警');
							this.setData({
								alarmed: true
							});
							this.triggerVoiceAlarm(2); // 2心率异常
						}
					} else {
						this.setData({
							heartLowCount: 0,
							heartHighCount: 0
						});
						console.log('心率正常，重置异常计数');
					}
				}

				// 如果所有指标都正常，重置告警状态
				if (breathRate >= this.data.breathThreshold &&
					heartRate >= this.data.heartThreshold &&
					heartRate <= this.data.heartHighThreshold) {
					if (this.data.alarmed) {
						console.log('所有指标恢复正常，重置告警状态');
					}
					this.setData({
						alarmed: false
					});
				}
			} else {
				console.log('设备数据获取失败或为空');
			}
		}).catch(error => {
			console.error('获取设备数据失败:', error);
		});
	},

	/**
	 * 触发语音告警
	 * @param {number} type 告警类型 1呼吸异常、2心率异常、3离床
	 */
	triggerVoiceAlarm(type = 1) {
		console.log('=== 开始触发语音告警 ===');
		console.log('告警类型:', type);
		console.log('当前告警状态:', this.data.alarmed);
		console.log('紧急联系人:', this.data.emergencyContacts);

		// 检查用户是否已登录
		if (!AuthApi.isLoggedIn()) {
			console.log('用户未登录，无法触发语音告警');
			return;
		}

		if (!this.data.emergencyContacts || this.data.emergencyContacts.length === 0) {
			console.log('紧急联系人为空，无法触发语音告警');
			wx.showToast({
				title: '请先设置紧急联系人',
				icon: 'none'
			});
			return;
		}

		// 检查deviceManager是否存在
		if (!this.deviceManager) {
			console.error('deviceManager未初始化');
			wx.showToast({
				title: '设备管理器未初始化，无法发送告警',
				icon: 'none',
				duration: 3000
			});
			return;
		}

		const typeNames = {
			1: '呼吸异常',
			2: '心率异常',
			3: '离床'
		};

		console.log('准备发送语音告警，联系人:', this.data.emergencyContacts, '类型:', typeNames[type]);

		// 为每个联系人发送告警
		const promises = this.data.emergencyContacts.map(phone => {
			return this.deviceManager.voiceNotifation({
				phone: phone,
				type: type
			});
		});

		Promise.all(promises).then(results => {
			console.log('所有语音告警发送完成:', results);
			const successCount = results.filter(res => res.ret === 0).length;
			wx.showToast({
				title: `已向${successCount}个联系人发送告警`,
				icon: 'success',
				duration: 2000
			});
		}).catch(error => {
			console.error('语音告警发送失败:', error);
			wx.showToast({
				title: '语音告警发送失败',
				icon: 'none',
				duration: 2000
			});
		});

		console.log('=== 语音告警触发完成 ===');
	},

	/**
	 * 切换协议卡片展开状态
	 */
	toggleProtocolExpanded() {
		this.setData({
			protocolExpanded: !this.data.protocolExpanded
		});
	},

	onShowProtocol() {
		this.setData({
			currentProtocolType: 'service',
			showProtocolViewer: true,
			protocolExpanded: false // 点击后收起卡片
		});
	},

	onShowAbout() {
		this.setData({
			currentProtocolType: 'user',
			showProtocolViewer: true,
			protocolExpanded: false // 点击后收起卡片
		});
	},

	/**
	 * 显示隐私政策
	 */
	onShowPrivacy() {
		this.setData({
			currentProtocolType: 'privacy',
			showProtocolViewer: true,
			protocolExpanded: false // 点击后收起卡片
		});
	},

	/**
	 * 关闭协议查看器
	 */
	onCloseProtocolViewer() {
		this.setData({
			showProtocolViewer: false
		});
	},

	/**
	 * 退出登录
	 */
	logout() {
		wx.showModal({
			title: '提示',
			content: '确定要退出登录吗？',
			success: (res) => {
				if (res.confirm) {
					// 清除用户信息
					AuthApi.clearUserInfo();

					// 停止呼吸监测
					this.stopBreathMonitor();

					// 关闭告警功能
					this.setData({
						alarmEnabled: false,
						alarmed: false,
						breathLowCount: 0,
						heartLowCount: 0,
						heartHighCount: 0,
						emergencyContacts: []
					});

					// 保存告警设置
					this.saveAlarmSettings();

					// 更新页面状态
					this.setData({
						isLogin: false,
						avatarUrl: '',
						userName: ''
					});

					wx.showToast({
						title: '退出登录成功',
						icon: 'success',
						duration: 2000
					});
				}
			}
		});
	},

	/**
	 * 阻止事件冒泡
	 */
	stopPropagation() {
		// 空方法，用於阻止事件冒泡
	},

	/**
	 * 编辑头像
	 */
	editAvatar() {
		this.setData({
			showNewAvatarModal: true,
			tempUserInfo: {
				avatarUrl: this.data.avatarUrl || '/static/default_avatar.png',
				nickName: this.data.userName || ''
			}
		});
	},

	/**
	 * 使用新的头像获取方式
	 */
	useNewAvatarMethod() {
		console.log('使用新的头像昵称获取方式');
		this.setData({
			showNewAvatarModal: true,
			showAvatarModal: false,
			tempUserInfo: {
				avatarUrl: this.data.avatarUrl || '/static/default_avatar.png',
				nickName: this.data.userName || ''
			}
		});
	},

	/**
	 * 关闭新的头像昵称获取弹窗
	 */
	closeNewAvatarModal() {
		this.setData({
			showNewAvatarModal: false,
			tempUserInfo: {
				avatarUrl: '',
				nickName: ''
			}
		});
	},

	/**
	 * 选择头像回调
	 */
	onChooseAvatar(e) {
		console.log('选择头像回调:', e);
		const {
			avatarUrl
		} = e.detail;
		const {
			nickName
		} = this.data.tempUserInfo;

		this.setData({
			'tempUserInfo.avatarUrl': avatarUrl,
			'tempUserInfo.nickName': nickName
		});

		console.log('更新临时用户信息:', this.data.tempUserInfo);
	},

	/**
	 * 昵称输入回调
	 */
	onInputChange(e) {
		console.log('昵称输入回调:', e);
		const nickName = e.detail.value;
		const {
			avatarUrl
		} = this.data.tempUserInfo;

		this.setData({
			'tempUserInfo.nickName': nickName,
			'tempUserInfo.avatarUrl': avatarUrl
		});

		console.log('更新临时用户信息:', this.data.tempUserInfo);
	},

	/**
	 * 保存新的用户信息
	 */
	saveNewUserInfo() {
		const {
			avatarUrl,
			nickName
		} = this.data.tempUserInfo;

		console.log('保存新的用户信息:', {
			avatarUrl,
			nickName
		});

		if (!avatarUrl || avatarUrl === '/static/default_avatar.png') {
			wx.showToast({
				title: '请选择头像',
				icon: 'none',
				duration: 2000
			});
			return;
		}

		if (!nickName || nickName.trim() === '') {
			wx.showToast({
				title: '请输入昵称',
				icon: 'none',
				duration: 2000
			});
			return;
		}

		// 更新用户信息
		this.updateUserInfoLocal(avatarUrl, nickName.trim());

		// 关闭弹窗
		this.closeNewAvatarModal();

		wx.showToast({
			title: '头像和昵称更新成功',
			icon: 'success',
			duration: 2000
		});
	},

	/**
	 * 更新用户信息（只保存到本地）
	 */
	updateUserInfoLocal(avatarUrl, nickName) {
		console.log('开始更新本地用户信息...');
		console.log('传入的头像URL:', avatarUrl);
		console.log('传入的昵称:', nickName);

		const userInfo = wx.getStorageSync('userInfo');
		console.log('当前本地用户信息:', userInfo);

		const updatedUserInfo = {
			...userInfo,
			avatar: avatarUrl || userInfo.avatar,
			nickname: nickName || userInfo.nickname
		};

		console.log('更新后的用户信息:', updatedUserInfo);

		// 保存到本地存储
		wx.setStorageSync('userInfo', updatedUserInfo);
		console.log('已保存到本地存儲');

		// 更新页面显示
		const newAvatarUrl = updatedUserInfo.avatar || '/static/default_avatar.png';
		const newUserName = updatedUserInfo.nickname || updatedUserInfo.account || '用户';

		console.log('准备更新页面显示:');
		console.log('新头像URL:', newAvatarUrl);
		console.log('新用户名:', newUserName);

		this.setData({
			avatarUrl: newAvatarUrl,
			userName: newUserName
		});

		console.log('页面显示已更新');
		console.log('本地用户信息更新成功:', updatedUserInfo);
	},

	/**
	 * 打开重置密码弹窗
	 */
	openResetPasswordModal() {
		// 关闭旧弹窗
		this.setData({
			showNewAvatarModal: false,
			showResetPasswordModal: true,
			resetPasswordForm: {
				mobile: '',
				code: '',
				password: ''
			},
			resetPasswordCountdown: 0
		});
		// 清除之前的定时器
		if (this.data.resetPasswordTimer) {
			clearInterval(this.data.resetPasswordTimer);
			this.setData({
				resetPasswordTimer: null
			});
		}
	},

	/**
	 * 关闭重置密码弹窗
	 */
	closeResetPasswordModal() {
		this.setData({
			showResetPasswordModal: false,
			resetPasswordForm: {
				mobile: '',
				code: '',
				password: ''
			},
			resetPasswordCountdown: 0
		});
		// 清除定时器
		if (this.data.resetPasswordTimer) {
			clearInterval(this.data.resetPasswordTimer);
			this.setData({
				resetPasswordTimer: null
			});
		}
	},

	/**
	 * 手机号输入
	 */
	onResetPasswordMobileInput(e) {
		this.setData({
			'resetPasswordForm.mobile': e.detail.value
		});
	},

	/**
	 * 验证码输入
	 */
	onResetPasswordCodeInput(e) {
		this.setData({
			'resetPasswordForm.code': e.detail.value
		});
	},

	/**
	 * 新密码输入
	 */
	onResetPasswordPasswordInput(e) {
		this.setData({
			'resetPasswordForm.password': e.detail.value
		});
	},

	/**
	 * 获取重置密码验证码
	 */
	getResetPasswordCaptcha() {
		const mobile = this.data.resetPasswordForm.mobile.trim();
		
		// 验证手机号
		if (!mobile) {
			wx.showToast({
				title: '请输入手机号',
				icon: 'none'
			});
			return;
		}

		if (!CommonUtil.isValidChinesePhone(mobile)) {
			wx.showToast({
				title: '请输入正确的手机号',
				icon: 'none'
			});
			return;
		}

		// 如果正在倒计时，不允许再次获取
		if (this.data.resetPasswordCountdown > 0) {
			return;
		}

		// 显示加载提示
		wx.showLoading({
			title: '发送中...'
		});

		// 调用API获取验证码
		BluetoothManager.ResetPasswordCaptcha(mobile)
			.then(res => {
				wx.hideLoading();
				console.log('获取重置密码验证码响应:', res);
				
				if (res.ret === 0 || res.code === 1) {
					wx.showToast({
						title: '验证码已发送',
						icon: 'success'
					});

					// 开始60秒倒计时
					this.setData({
						resetPasswordCountdown: 60
					});

					const timer = setInterval(() => {
						if (this.data.resetPasswordCountdown > 1) {
							this.setData({
								resetPasswordCountdown: this.data.resetPasswordCountdown - 1
							});
						} else {
							clearInterval(timer);
							this.setData({
								resetPasswordCountdown: 0,
								resetPasswordTimer: null
							});
						}
					}, 1000);

					this.setData({
						resetPasswordTimer: timer
					});
				} else {
					wx.showToast({
						title: res.msg || '验证码发送失败',
						icon: 'none'
					});
				}
			})
			.catch(error => {
				wx.hideLoading();
				console.error('获取重置密码验证码失败:', error);
				wx.showToast({
					title: '验证码发送失败，请重试',
					icon: 'none'
				});
			});
	},

	/**
	 * 提交重置密码
	 */
	submitResetPassword() {
		const { mobile, code, password } = this.data.resetPasswordForm;

		// 验证输入
		if (!mobile || !mobile.trim()) {
			wx.showToast({
				title: '请输入手机号',
				icon: 'none'
			});
			return;
		}

		if (!CommonUtil.isValidChinesePhone(mobile.trim())) {
			wx.showToast({
				title: '请输入正确的手机号',
				icon: 'none'
			});
			return;
		}

		if (!code || !code.trim()) {
			wx.showToast({
				title: '请输入验证码',
				icon: 'none'
			});
			return;
		}

		if (!password || !password.trim()) {
			wx.showToast({
				title: '请输入新密码',
				icon: 'none'
			});
			return;
		}

		if (password.trim().length < 6) {
			wx.showToast({
				title: '密码长度至少6位',
				icon: 'none'
			});
			return;
		}

		// 显示加载提示
		wx.showLoading({
			title: '提交中...'
		});

		// 调用重置密码API
		BluetoothManager.ResetPassword(password.trim(), code.trim(), mobile.trim())
			.then(res => {
				wx.hideLoading();
				console.log('重置密码响应:', res);
				
				if (res.ret === 0 || res.code === 1) {
					wx.showToast({
						title: '密码重置成功',
						icon: 'success'
					});
					
					// 关闭弹窗
					this.closeResetPasswordModal();
				} else {
					wx.showToast({
						title: res.msg || '密码重置失败',
						icon: 'none'
					});
				}
			})
			.catch(error => {
				wx.hideLoading();
				console.error('重置密码失败:', error);
				wx.showToast({
					title: '密码重置失败，请重试',
					icon: 'none'
				});
			});
	}
});