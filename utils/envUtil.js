/**
 * 环境判断工具
 */
class EnvUtil {
    /**
     * 获取当前环境类型
     * @returns {string} 'develop' | 'trial' | 'release'
     */
    static getEnvVersion() {
        try {
            // 方法1：使用 __wxConfig
            if (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion) {
                return __wxConfig.envVersion;
            }
            
            // 方法2：使用 wx.getAccountInfoSync()
            const accountInfo = wx.getAccountInfoSync();
            return accountInfo.miniProgram.envVersion;
        } catch (error) {
            console.warn('获取环境版本失败:', error);
            return 'unknown';
        }
    }
    
    /**
     * 判断是否为开发环境
     * @returns {boolean}
     */
    static isDev() {
        return this.getEnvVersion() === 'develop';
    }
    
    /**
     * 判断是否为体验版
     * @returns {boolean}
     */
    static isTrial() {
        return this.getEnvVersion() === 'trial';
    }
    
    /**
     * 判断是否为正式版
     * @returns {boolean}
     */
    static isRelease() {
        return this.getEnvVersion() === 'release';
    }
    
    /**
     * 判断是否为开发者工具
     * @returns {boolean}
     */
    static isDevTools() {
        try {
            const systemInfo = wx.getSystemInfoSync();
            return systemInfo.platform === 'devtools';
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 获取环境描述
     * @returns {string}
     */
    static getEnvDescription() {
        const envVersion = this.getEnvVersion();
        const isDevTools = this.isDevTools();
        
        const envMap = {
            'develop': '开发版',
            'trial': '体验版',
            'release': '正式版',
            'unknown': '未知环境'
        };
        
        let description = envMap[envVersion] || '未知环境';
        
        if (isDevTools) {
            description += ' (开发者工具)';
        }
        
        return description;
    }
    
    /**
     * 打印环境信息
     */
    static logEnvInfo() {
        console.log('=== 环境信息 ===');
        console.log('环境版本:', this.getEnvVersion());
        console.log('环境描述:', this.getEnvDescription());
        console.log('是否开发环境:', this.isDev());
        console.log('是否体验版:', this.isTrial());
        console.log('是否正式版:', this.isRelease());
        console.log('是否开发者工具:', this.isDevTools());
        console.log('===============');
    }
}

module.exports = EnvUtil;
