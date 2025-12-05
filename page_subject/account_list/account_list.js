const AuthApi = require('../../utils/authApi');
const AccountManager = require('../../utils/accountManager');
const BluetoothManager = require('../../utils/bluetoothManager');

Page({
  data: {
    accounts: [],
    isLoading: false,
    hasError: false,
    lastUpdated: '',
    pageNo: 1,
    pageSize: 15,
    hasMore: true,
    isLoadingMore: false,
    showAddModal: false,
    addForm: {
      account: '',
      password: ''
    },
    addSubmitting: false,
    switchingAccountId: null,
    unbindingAccountId: null
  },

  onLoad() {
    this.loadAccounts();
  },

  onPullDownRefresh() {
    this.loadAccounts(true);
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoading || this.data.isLoadingMore) {
      return;
    }
    this.loadAccounts(false, { append: true });
  },

  onBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  onRefreshTap() {
    this.loadAccounts(true);
  },

  onAddTap() {
    if (!AuthApi.isLoggedIn()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    this.setData({
      showAddModal: true
    });
  },

  onAddModalClose() {
    if (this.data.addSubmitting) {
      return;
    }
    this._resetAddForm();
  },

  onAddInputChange(event) {
    const { field } = event.currentTarget.dataset || {};
    if (!field) {
      return;
    }
    const value = event.detail?.value ?? '';
    this.setData({
      addForm: {
        ...this.data.addForm,
        [field]: value
      }
    });
  },

  async onConfirmAdd() {
    if (this.data.addSubmitting) {
      return;
    }
    if (!AuthApi.isLoggedIn()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    const account = (this.data.addForm.account || '').trim();
    const password = (this.data.addForm.password || '').trim();

    if (!account) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'
      });
      return;
    }
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    this.setData({ addSubmitting: true });
    try {
      const response = await BluetoothManager.AddFastUser(account, password);
      wx.showToast({
        title: response?.msg || '添加成功',
        icon: 'success'
      });
      this._resetAddForm();
      this.loadAccounts(false);
    } catch (error) {
      console.error('添加快捷账号失败:', error);
      wx.showToast({
        title: '添加失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      if (this.data.addSubmitting) {
        this.setData({ addSubmitting: false });
      }
    }
  },

  async loadAccounts(showToast = false, options = {}) {
    const { append = false } = options;
    if (append && (!this.data.hasMore || this.data.isLoadingMore)) {
      return;
    }
    if (!append && this.data.isLoading) {
      return;
    }

    if (!AuthApi.isLoggedIn()) {
      if (append) {
        return;
      }
      this.setData({
        accounts: [],
        isLoading: false,
        hasError: false,
        isLoadingMore: false,
        hasMore: false
      });
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const nextPage = append ? this.data.pageNo + 1 : 1;
    this.setData({
      isLoading: append ? false : true,
      isLoadingMore: append,
      hasError: false,
      ...(append ? {} : { pageNo: 1, hasMore: true })
    });

    try {
      const response = await BluetoothManager.GetFastUserList(nextPage, this.data.pageSize);
      const { list, hasMore } = this._transformAccountResponse(response, nextPage);
      const mergedList = response?.data?.lists && Array.isArray(response.data.lists) && response.data.lists.length
        ? response.data.lists
        : response.data.lists;
      const nextAccounts = append ? [...this.data.accounts, ...mergedList] : mergedList;

      this.setData({
        accounts: nextAccounts,
        pageNo: nextPage,
        hasMore,
        isLoading: false,
        isLoadingMore: false,
        lastUpdated: this._formatTimestamp(new Date())
      });

      if (showToast) {
        wx.showToast({
          title: append ? '加载成功' : '已刷新',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('加载账号列表失败:', error);
      this.setData({
        hasError: append ? this.data.hasError : true,
        isLoading: false,
        isLoadingMore: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      if (!append) {
        wx.stopPullDownRefresh();
      }
    }
  },

  copyAccount(event) {
    const { account } = event.currentTarget.dataset;
    if (!account) {
      return;
    }
    wx.setClipboardData({
      data: account,
      success: () => {
        wx.showToast({
          title: '账号已复制',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  async onSwitchAccountTap(event) {
    const { mobile, password, accountId } = event.currentTarget.dataset || {};
    if (!mobile || !password) {
      wx.showToast({
        title: '账号信息不完整',
        icon: 'none'
      });
      return;
    }
    if (this.data.switchingAccountId === accountId) {
      return;
    }

    this.setData({ switchingAccountId: accountId });
    wx.showLoading({
      title: '切换中...',
      mask: true
    });

    try {
      const response = await AuthApi.login({
        terminal: '7',
        scene: '1',
        account: mobile,
        password
      });
	  console.log("response",response)
      if (response?.code === 1 && response.data) {
        AuthApi.saveUserInfo(response.data);
        wx.showToast({
          title: '切换成功',
          icon: 'success'
        });
        this.loadAccounts(false);
      } else {
        wx.showToast({
          title: response?.msg || '切换失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('切换账号登录失败:', error);
      wx.showToast({
        title: '切换失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ switchingAccountId: null });
    }
  },

  _transformAccountResponse(response, pageNo) {
    const payload = response && typeof response === 'object' ? (response.data || response) : {};
    const rawList = this._extractListFromPayload(payload);
    let list = rawList
      .map((item, index) => this._normalizeAccountEntry(item, index))
      .filter(item => !!item);

    if (!list.length && pageNo === 1) {
      list = AccountManager.getAccountList();
    }

    const totalPages = this._extractTotalPages(response);
    const hasMore = typeof totalPages === 'number'
      ? pageNo < totalPages
      : list.length >= this.data.pageSize;

    return {
      list,
      hasMore
    };
  },

  _extractListFromPayload(payload) {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (typeof payload !== 'object') {
      return [];
    }

    const candidateKeys = ['list', 'lists', 'rows', 'items', 'data', 'datas', 'records', 'account_list', 'accounts', 'result'];
    for (const key of candidateKeys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === 'object' && value !== payload) {
        const nested = this._extractListFromPayload(value);
        if (nested.length) {
          return nested;
        }
      }
    }
    return [];
  },

  _extractTotalPages(response) {
    if (!response || typeof response !== 'object') {
      return null;
    }
    const payloads = [response, response.data, response?.data?.data, response.result];
    const pageKeys = ['total_page', 'totalPage', 'totalPages', 'pages', 'page_total', 'last_page', 'pageCount'];

    for (const payload of payloads) {
      if (!payload || typeof payload !== 'object') {
        continue;
      }
      for (const key of pageKeys) {
        const value = payload[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
          return value;
        }
      }
      const total = payload.total || payload.totalCount || payload.total_count;
      if (typeof total === 'number' && total >= 0) {
        return Math.ceil(total / this.data.pageSize);
      }
    }
    return null;
  },

  _normalizeAccountEntry(entry, index = 0) {
    if (!entry) {
      return null;
    }
    if (typeof entry === 'string') {
      return {
        id: `account-${index}`,
        account: entry,
        nickname: entry,
        role: index === 0 ? '主账号' : '成员',
        status: '已启用',
        mobile: entry,
        isOwner: index === 0
      };
    }
    if (typeof entry !== 'object') {
      return null;
    }

    const accountId = entry.id || entry.account_id || entry.account || entry.mobile || `account-${index}`;
    const account = entry.account || entry.account_name || entry.mobile || entry.phone || '';
    const nickname = entry.nickname || entry.name || entry.remark || account || `账号${index + 1}`;
    const role = entry.role || entry.identity || (entry.isOwner ? '主账号' : (index === 0 ? '主账号' : '成员'));
    const status = entry.status || (entry.enabled === false ? '已停用' : '已启用');

    return {
      id: accountId,
      account,
      nickname,
      role,
      status,
      mobile: entry.mobile || entry.phone || account,
      isOwner: typeof entry.isOwner === 'boolean' ? entry.isOwner : index === 0,
      remark: entry.remark || entry.desc || ''
    };
  },

  _formatTimestamp(date) {
    if (!(date instanceof Date)) {
      return '';
    }
    const pad = num => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  _resetAddForm() {
    this.setData({
      showAddModal: false,
      addSubmitting: false,
      addForm: {
        account: '',
        password: ''
      }
    });
  },

  // 解除绑定账号
  async onUnbindAccountTap(event) {
    const { id } = event.currentTarget.dataset || {};
    if (!id) {
      wx.showToast({
        title: '账号信息不完整',
        icon: 'none'
      });
      return;
    }

    if (this.data.unbindingAccountId === id) {
      return;
    }

    // 确认解除绑定
    wx.showModal({
      title: '提示',
      content: '确定要解除绑定该账号吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ unbindingAccountId: id });
          wx.showLoading({
            title: '解除绑定中...',
            mask: true
          });

          try {
            // 调用解除绑定API，传入target_user_id
            const result = await BluetoothManager.UnbindFast(id);
            console.log('解除绑定响应:', result);
            
            wx.hideLoading();
            
            // 检查响应结果
            if (result.ret === 0 || result.code === 1 || result.code === '1') {
              wx.showToast({
                title: '解除绑定成功',
                icon: 'success'
              });
              
              // 刷新账号列表
              setTimeout(() => {
                this.loadAccounts(false);
              }, 500);
            } else {
              wx.showModal({
                title: '提示',
                content: result.msg || result.message || '解除绑定失败，请重试',
                showCancel: false,
                confirmText: '确定'
              });
            }
          } catch (error) {
            console.error('解除绑定失败:', error);
            wx.hideLoading();
            wx.showModal({
              title: '提示',
              content: error.message || '解除绑定失败，请检查网络后重试',
              showCancel: false,
              confirmText: '确定'
            });
          } finally {
            this.setData({ unbindingAccountId: null });
          }
        }
      }
    });
  }
});

