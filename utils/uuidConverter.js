/**
 * UUID转换工具类
 */
class UuidConverter {
    /**
     * 将UUID格式转换为简化的MAC地址格式
     * @param {string} uuid 原始UUID
     * @param {Array} advertisServiceUUIDs 广播服务UUID数组（可选）
     * @returns {string} 转换后的MAC地址格式
     */
    static convertUUIDToMacFormat(uuid, advertisServiceUUIDs = null) {
        if (!uuid) return '';
        
        console.log('开始转换UUID:', uuid);
        console.log('广播服务UUID数组:', advertisServiceUUIDs);
        
        // 如果已经是MAC地址格式（包含冒号），直接返回
        if (uuid.includes(':')) {
            console.log('已经是MAC地址格式，无需转换');
            return uuid;
        }
        
        // 方法0：从advertisServiceUUIDs数组提取MAC地址（最高优先级）
        if (advertisServiceUUIDs && advertisServiceUUIDs.length >= 3) {
            console.log('使用advertisServiceUUIDs方法转换MAC地址');
            let macParts = [];
            
            // 提取前三个UUID的前8位字符
            for (let i = 0; i < 3; i++) {
                const serviceUUID = advertisServiceUUIDs[i];
                if (serviceUUID && serviceUUID.length >= 8) {
                    const first8Chars = serviceUUID.substring(0, 8);
                    // 提取非零部分（去掉前导零）
                    const nonZeroPart = first8Chars.replace(/^0+/, '');
                    if (nonZeroPart.length > 0) {
                        macParts.push(nonZeroPart);
                    } else {
                        // 如果全是零，取最后4位
                        macParts.push(first8Chars.substring(4));
                    }
                }
            }
            
            if (macParts.length === 3) {
                // 拼接并格式化为MAC地址
                const combined = macParts.join('');
                let macAddress = '';
                for (let i = 0; i < 12; i += 2) {
                    if (i > 0) macAddress += ':';
                    macAddress += combined.substring(i, i + 2);
                }
                console.log('从advertisServiceUUIDs转换MAC地址:', uuid, '->', macAddress);
                return macAddress;
            }
        }
        
        // iOS设备转换失败，返回原始UUID
        console.log('iOS设备UUID转换失败，advertisServiceUUIDs不足3个或格式不正确:', uuid);
        return uuid;
    }
}

module.exports = UuidConverter; 