/**
 * UUID轉換工具類
 */
class UuidConverter {
    /**
     * 將UUID格式轉換為簡化的MAC地址格式
     * @param {string} uuid 原始UUID
     * @param {Array} advertisServiceUUIDs 廣播服務UUID數組（可選）
     * @returns {string} 轉換後的MAC地址格式
     */
    static convertUUIDToMacFormat(uuid, advertisServiceUUIDs = null) {
        if (!uuid) return '';
        
        console.log('開始轉換UUID:', uuid);
        console.log('廣播服務UUID數組:', advertisServiceUUIDs);
        
        // 如果已經是MAC地址格式（包含冒號），直接返回
        if (uuid.includes(':')) {
            console.log('已經是MAC地址格式，無需轉換');
            return uuid;
        }
        
        // 方法0：從advertisServiceUUIDs數組提取MAC地址（最高優先級）
        if (advertisServiceUUIDs && advertisServiceUUIDs.length >= 3) {
            console.log('使用advertisServiceUUIDs方法轉換MAC地址');
            let macParts = [];
            
            // 提取前三個UUID的前8位字符
            for (let i = 0; i < 3; i++) {
                const serviceUUID = advertisServiceUUIDs[i];
                if (serviceUUID && serviceUUID.length >= 8) {
                    const first8Chars = serviceUUID.substring(0, 8);
                    // 提取非零部分（去掉前導零）
                    const nonZeroPart = first8Chars.replace(/^0+/, '');
                    if (nonZeroPart.length > 0) {
                        macParts.push(nonZeroPart);
                    } else {
                        // 如果全是零，取最後4位
                        macParts.push(first8Chars.substring(4));
                    }
                }
            }
            
            if (macParts.length === 3) {
                // 拼接並格式化為MAC地址
                const combined = macParts.join('');
                let macAddress = '';
                for (let i = 0; i < 12; i += 2) {
                    if (i > 0) macAddress += ':';
                    macAddress += combined.substring(i, i + 2);
                }
                console.log('從advertisServiceUUIDs轉換MAC地址:', uuid, '->', macAddress);
                return macAddress;
            }
        }
        
        // iOS設備轉換失敗，返回原始UUID
        console.log('iOS設備UUID轉換失敗，advertisServiceUUIDs不足3個或格式不正確:', uuid);
        return uuid;
    }
}

module.exports = UuidConverter; 